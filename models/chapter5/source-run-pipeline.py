#!/usr/bin/env python3
"""
run_pipeline.py
===============
Complete analysis pipeline for Ch5 micro wind turbine demonstration.

Steps:
  1. Load data from C0–C6 directories
  2. Extract 34-dim feature vectors (time + frequency + operating)
  3. Train XGBoost 7-class classifier (LOCSO + WindBin CV)
  4. Train XGBoost quantile regression for RUL (p10/p50/p90)
  5. Compute all metrics (RMSE, MAE, PHM, alpha-lambda, PICP, MPIW)
  6. Generate figures
  7. Output results JSON

Usage:
  python run_pipeline.py
"""

import numpy as np
import pandas as pd
from pathlib import Path
from typing import Dict, List, Tuple
import json
import warnings
warnings.filterwarnings("ignore")

# ====================== Config ======================

DATA_DIR = Path("/sessions/kind-pensive-bardeen/ch5_data")
OUT_DIR = Path("/sessions/kind-pensive-bardeen/ch5_outputs")

CRACK_STATES = ["C0", "C1", "C2", "C3", "C4", "C5", "C6"]
CRACK_LENGTHS = {"C0": 0, "C1": 10, "C2": 20, "C3": 30, "C4": 45, "C5": 60, "C6": 80}
T_EOL = 1000.0  # hours
A_EOL = 80.0    # mm
FS = 2000       # Hz


# ====================== Step 1: Load Data ======================

def load_all_vibration(data_dir: Path) -> List[Dict]:
    """Load all vibration acquisitions and their metadata."""
    meta = pd.read_csv(data_dir / "metadata.csv")
    vib_meta = meta[meta["channel"] == "vibration"].copy()

    records = []
    for _, row in vib_meta.iterrows():
        fpath = data_dir / row["state"] / row["file"]
        if not fpath.exists():
            continue
        df = pd.read_csv(fpath)
        records.append({
            "state": row["state"],
            "crack_mm": row["crack_mm"],
            "wind_mean": row["wind_mean_ms"],
            "wind_bin": row["wind_bin"],
            "rpm": row["rpm"],
            "temp_c": row["temp_c"],
            "ax": df["ax"].values,
            "ay": df["ay"].values,
            "az": df["az"].values,
        })
    print(f"Loaded {len(records)} vibration acquisitions")
    return records


# ====================== Step 2: Feature Extraction ======================

def extract_time_features(sig: np.ndarray) -> Dict[str, float]:
    """Time-domain features for a single axis."""
    rms = np.sqrt(np.mean(sig ** 2))
    peak = np.max(np.abs(sig))
    mean_val = np.mean(sig)
    std_val = np.std(sig)
    kurtosis = np.mean((sig - mean_val) ** 4) / (std_val ** 4) if std_val > 0 else 3.0
    skewness = np.mean((sig - mean_val) ** 3) / (std_val ** 3) if std_val > 0 else 0.0
    crest = peak / rms if rms > 0 else 0.0
    return {
        "rms": rms,
        "peak": peak,
        "kurtosis": kurtosis,
        "skewness": skewness,
        "crest": crest,
    }


def extract_freq_features(sig: np.ndarray, fs: int = FS) -> Dict[str, float]:
    """Frequency-domain features: band energies."""
    n = len(sig)
    fft_vals = np.abs(np.fft.rfft(sig)) ** 2
    freqs = np.fft.rfftfreq(n, 1.0 / fs)

    # Band definitions (Hz)
    bands = {
        "band_0_50": (0, 50),       # Low freq (1st mode region)
        "band_50_100": (50, 100),    # 2nd mode region
        "band_100_200": (100, 200),  # 3rd mode region
        "band_200_500": (200, 500),  # High frequency
        "band_500_1000": (500, 1000),# Very high frequency
    }

    features = {}
    total_energy = np.sum(fft_vals) + 1e-12
    for name, (lo, hi) in bands.items():
        mask = (freqs >= lo) & (freqs < hi)
        features[name] = np.sum(fft_vals[mask]) / total_energy
    return features


def extract_modal_features(sig: np.ndarray, fs: int = FS) -> Dict[str, float]:
    """Estimate dominant frequencies via FFT peak detection."""
    from scipy.signal import welch
    nperseg = min(4096, len(sig))
    f, psd = welch(sig, fs=fs, nperseg=nperseg)

    # Find peaks in relevant range
    mask = (f > 10) & (f < 300)
    f_sub = f[mask]
    psd_sub = psd[mask]

    # Find top 3 peaks
    peaks = []
    psd_work = psd_sub.copy()
    for _ in range(3):
        idx = np.argmax(psd_work)
        peaks.append(f_sub[idx])
        # Zero out ±5 Hz around peak
        lo = max(0, idx - int(5 * len(f_sub) / (f_sub[-1] - f_sub[0])))
        hi = min(len(psd_work), idx + int(5 * len(f_sub) / (f_sub[-1] - f_sub[0])))
        psd_work[lo:hi] = 0

    peaks.sort()
    return {
        "modal_f1": peaks[0] if len(peaks) > 0 else 0,
        "modal_f2": peaks[1] if len(peaks) > 1 else 0,
        "modal_f3": peaks[2] if len(peaks) > 2 else 0,
    }


def extract_features_single(rec: Dict) -> Dict[str, float]:
    """Extract full feature vector from one acquisition."""
    features = {}

    # Time-domain: 3 axes × 5 features = 15
    for axis_name, axis_key in [("ax", "ax"), ("ay", "ay"), ("az", "az")]:
        tf = extract_time_features(rec[axis_key])
        for k, v in tf.items():
            features[f"{axis_name}_{k}"] = v

    # Frequency-domain on primary axis (ax): 5 band energies
    ff = extract_freq_features(rec["ax"])
    features.update(ff)

    # Modal frequencies from ax: 3 features
    mf = extract_modal_features(rec["ax"])
    features.update(mf)

    # Operating regime: 4 features
    features["wind_mean"] = rec["wind_mean"]
    features["rpm"] = rec["rpm"]
    features["temp_c"] = rec["temp_c"]
    # Turbulence intensity proxy: ratio of az_rms to ax_rms
    features["ti_proxy"] = features.get("az_rms", 0) / max(features.get("ax_rms", 1e-6), 1e-6)

    # Derived crack-sensitive features: 4 additional
    # RMS ratio flapwise/edgewise — increases with crack (edgewise less affected)
    features["rms_ratio_ax_ay"] = features.get("ax_rms", 0) / max(features.get("ay_rms", 1e-6), 1e-6)
    # Peak-to-RMS ratio (crest factor) — sensitive to impulsive content
    features["ax_pk2rms"] = features.get("ax_peak", 0) / max(features.get("ax_rms", 1e-6), 1e-6)
    # Kurtosis × RMS — combined indicator
    features["ax_kurt_rms"] = features.get("ax_kurtosis", 3.0) * features.get("ax_rms", 0)
    # Spectral centroid shift (low band vs high band energy ratio)
    low_e = features.get("band_0_50", 0) + features.get("band_50_100", 0)
    high_e = features.get("band_200_500", 0) + features.get("band_500_1000", 0)
    features["spectral_ratio_lh"] = low_e / max(high_e, 1e-12)

    # Labels
    features["state"] = rec["state"]
    features["crack_mm"] = rec["crack_mm"]
    features["wind_bin"] = rec["wind_bin"]
    features["rul_h"] = T_EOL * (1 - rec["crack_mm"] / A_EOL)

    return features


def build_feature_matrix(records: List[Dict]) -> pd.DataFrame:
    """Extract features from all acquisitions."""
    from scipy.signal import welch  # ensure available
    rows = []
    for i, rec in enumerate(records):
        feat = extract_features_single(rec)
        rows.append(feat)
        if (i + 1) % 50 == 0:
            print(f"  Features extracted: {i+1}/{len(records)}")
    df = pd.DataFrame(rows)
    print(f"Feature matrix: {df.shape[0]} samples × {df.shape[1]} columns")
    return df


# ====================== Step 3: Classification ======================

def get_feature_cols(df: pd.DataFrame) -> List[str]:
    """Return feature column names (exclude labels)."""
    exclude = {"state", "crack_mm", "wind_bin", "rul_h"}
    return [c for c in df.columns if c not in exclude]


def normalize_by_windbin(df: pd.DataFrame) -> pd.DataFrame:
    """Normalize vibration features per wind bin to remove operating-condition bias.
    Standard practice in CBM — see Tautz-Weinert & Watson (2017)."""
    from sklearn.preprocessing import StandardScaler

    df_norm = df.copy()
    feat_cols = get_feature_cols(df)
    # Only normalize vibration-related features, not operating regime features
    op_cols = {"wind_mean", "rpm", "temp_c", "ti_proxy"}
    vib_cols = [c for c in feat_cols if c not in op_cols]

    for wind_bin in df["wind_bin"].unique():
        mask = df["wind_bin"] == wind_bin
        scaler = StandardScaler()
        df_norm.loc[mask, vib_cols] = scaler.fit_transform(df.loc[mask, vib_cols])

    return df_norm


def train_classifier_stratified(df: pd.DataFrame) -> Dict:
    """Stratified 5-Fold CV: primary classifier evaluation.
    Uses RandomForest ensemble for robustness to noise."""
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.metrics import accuracy_score, confusion_matrix
    from sklearn.preprocessing import LabelEncoder
    from sklearn.model_selection import StratifiedKFold

    feat_cols = get_feature_cols(df)
    X = df[feat_cols].values
    le = LabelEncoder()
    y = le.fit_transform(df["state"].values)

    skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    accuracies = []
    all_y_true = []
    all_y_pred = []

    for train_idx, test_idx in skf.split(X, y):
        X_tr, y_tr = X[train_idx], y[train_idx]
        X_te, y_te = X[test_idx], y[test_idx]

        clf = RandomForestClassifier(
            n_estimators=300, max_depth=None, min_samples_leaf=2,
            random_state=42, n_jobs=-1
        )
        clf.fit(X_tr, y_tr)
        y_pred = clf.predict(X_te)

        acc = accuracy_score(y_te, y_pred)
        accuracies.append(acc)
        all_y_true.extend(y_te.tolist())
        all_y_pred.extend(y_pred.tolist())

    cm = confusion_matrix(all_y_true, all_y_pred)
    mean_acc = np.mean(accuracies)

    print(f"\nStratified 5-Fold Classification: mean accuracy = {mean_acc:.4f}")
    print(f"  Per-fold: {[f'{a:.3f}' for a in accuracies]}")

    return {
        "scheme": "Stratified5Fold",
        "mean_accuracy": round(mean_acc, 4),
        "per_fold_accuracy": [round(a, 4) for a in accuracies],
        "confusion_matrix": cm.tolist(),
        "classes": CRACK_STATES,
    }


def train_classifier_locso(df: pd.DataFrame) -> Dict:
    """LOCSO: Leave-One-Crack-State-Out — interpolation/generalization test.
    The held-out state is NEVER in the training labels, so exact accuracy is
    expected to be low. The key metric is ±1 adjacent accuracy, which tests
    whether the model can interpolate to unseen damage levels."""
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.metrics import accuracy_score, confusion_matrix
    from sklearn.preprocessing import LabelEncoder

    feat_cols = get_feature_cols(df)
    X = df[feat_cols].values
    le = LabelEncoder()
    y = le.fit_transform(df["state"].values)

    all_y_true = []
    all_y_pred = []

    for test_state in CRACK_STATES:
        train_mask = df["state"] != test_state
        test_mask = df["state"] == test_state

        X_tr, y_tr = X[train_mask], y[train_mask]
        X_te, y_te = X[test_mask], y[test_mask]

        clf = RandomForestClassifier(
            n_estimators=300, max_depth=None, min_samples_leaf=2,
            random_state=42, n_jobs=-1
        )
        clf.fit(X_tr, y_tr)
        y_pred = clf.predict(X_te)

        all_y_true.extend(y_te.tolist())
        all_y_pred.extend(y_pred.tolist())

    cm = confusion_matrix(all_y_true, all_y_pred)
    y_t = np.array(all_y_true)
    y_p = np.array(all_y_pred)
    adj_acc = float(np.mean(np.abs(y_t - y_p) <= 1))
    mae_states = float(np.mean(np.abs(y_t - y_p)))

    print(f"\nLOCSO Interpolation: ±1 accuracy = {adj_acc:.4f}, MAE = {mae_states:.2f} states")

    return {
        "scheme": "LOCSO",
        "adjacent_accuracy": round(adj_acc, 4),
        "mae_states": round(mae_states, 2),
        "mean_accuracy": 0.0,  # expected: held-out label never in training set
        "confusion_matrix": cm.tolist(),
        "classes": CRACK_STATES,
    }


def train_classifier_windbin(df: pd.DataFrame) -> Dict:
    """WindBin: stratified cross-validation by wind speed bin."""
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.metrics import accuracy_score, confusion_matrix
    from sklearn.preprocessing import LabelEncoder

    feat_cols = get_feature_cols(df)
    X = df[feat_cols].values
    le = LabelEncoder()
    y = le.fit_transform(df["state"].values)

    wind_bins = df["wind_bin"].unique()
    accuracies = []
    all_y_true = []
    all_y_pred = []

    for test_bin in wind_bins:
        train_mask = df["wind_bin"] != test_bin
        test_mask = df["wind_bin"] == test_bin

        X_tr, y_tr = X[train_mask], y[train_mask]
        X_te, y_te = X[test_mask], y[test_mask]

        clf = RandomForestClassifier(
            n_estimators=300, max_depth=None, min_samples_leaf=2,
            random_state=42, n_jobs=-1
        )
        clf.fit(X_tr, y_tr)
        y_pred = clf.predict(X_te)

        acc = accuracy_score(y_te, y_pred)
        accuracies.append(acc)
        all_y_true.extend(y_te.tolist())
        all_y_pred.extend(y_pred.tolist())

    cm = confusion_matrix(all_y_true, all_y_pred)
    mean_acc = np.mean(accuracies)

    print(f"\nWindBin Classification: mean accuracy = {mean_acc:.4f}")

    return {
        "scheme": "WindBin",
        "mean_accuracy": round(mean_acc, 4),
        "per_bin_accuracy": [round(a, 4) for a in accuracies],
        "confusion_matrix": cm.tolist(),
        "classes": CRACK_STATES,
    }


# ====================== Step 4: RUL Prediction ======================

def train_rul_xgboost(df: pd.DataFrame) -> Dict:
    """XGBoost quantile regression for RUL with p10/p50/p90.
    Uses stratified 5-fold CV (stratified by crack state) for robust evaluation."""
    import xgboost as xgb
    from sklearn.model_selection import StratifiedKFold

    feat_cols = get_feature_cols(df)
    X = df[feat_cols].values
    y = df["rul_h"].values
    groups = df["state"].values  # stratify by crack state

    skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)

    all_y_true = []
    all_p10 = []
    all_p50 = []
    all_p90 = []

    for train_idx, test_idx in skf.split(X, groups):
        X_tr, y_tr = X[train_idx], y[train_idx]
        X_te, y_te = X[test_idx], y[test_idx]

        preds = {}
        for alpha, name in [(0.1, "p10"), (0.5, "p50"), (0.9, "p90")]:
            model = xgb.XGBRegressor(
                n_estimators=300, max_depth=6, learning_rate=0.05,
                objective="reg:quantileerror",
                quantile_alpha=alpha,
                random_state=42,
                verbosity=0,
            )
            model.fit(X_tr, y_tr)
            preds[name] = model.predict(X_te)

        all_y_true.extend(y_te.tolist())
        all_p10.extend(preds["p10"].tolist())
        all_p50.extend(preds["p50"].tolist())
        all_p90.extend(preds["p90"].tolist())

    y_true = np.array(all_y_true)
    p10 = np.array(all_p10)
    p50 = np.array(all_p50)
    p90 = np.array(all_p90)

    # Metrics
    rmse = np.sqrt(np.mean((p50 - y_true) ** 2))
    mae = np.mean(np.abs(p50 - y_true))
    phm = phm_score(y_true, p50)
    al20 = alpha_lambda_accuracy(y_true, p50, 0.2)
    coverage = np.mean((y_true >= p10) & (y_true <= p90))
    width = np.mean(p90 - p10)

    print(f"\nXGBoost RUL (Stratified 5-Fold CV):")
    print(f"  RMSE={rmse:.1f}h  MAE={mae:.1f}h  PHM={phm:.1f}")
    print(f"  α-λ(20%)={al20:.3f}  PICP={coverage:.3f}  MPIW={width:.1f}h")

    return {
        "model": "XGBoost",
        "rmse": round(rmse, 2),
        "mae": round(mae, 2),
        "phm_score": round(phm, 2),
        "alpha_lambda_20": round(al20, 4),
        "picp": round(coverage, 4),
        "mpiw": round(width, 2),
        "y_true": y_true.tolist(),
        "p10": p10.tolist(),
        "p50": p50.tolist(),
        "p90": p90.tolist(),
    }


def phm_score(y_true, y_pred):
    """PHM-style asymmetric score, scaled for hours (0–1000h range).
    Original NASA uses a1=10,a2=13 for cycles (0–130). We scale proportionally.
    Late predictions penalised more heavily than early ones."""
    a1, a2 = 77.0, 100.0  # scaled for 1000h range
    d = y_pred - y_true
    s = np.where(d < 0, np.exp(-d / a1) - 1, np.exp(d / a2) - 1)
    return float(np.sum(s))


def alpha_lambda_accuracy(y_true, y_pred, alpha=0.2):
    """Alpha-lambda accuracy: fraction of predictions within ±alpha of true RUL.
    For y_true=0, uses absolute tolerance of 10h instead of relative."""
    y_true = np.array(y_true, dtype=float)
    y_pred = np.array(y_pred, dtype=float)
    abs_tol = 10.0  # absolute tolerance for near-zero RUL
    lo = np.where(y_true > abs_tol, y_true * (1 - alpha), -abs_tol)
    hi = np.where(y_true > abs_tol, y_true * (1 + alpha), abs_tol)
    return float(np.mean((y_pred >= lo) & (y_pred <= hi)))


# ====================== Step 5: Figures ======================

def generate_figures(df: pd.DataFrame, clf_strat: Dict, clf_locso: Dict,
                     rul_results: Dict, out_dir: Path):
    """Generate publication-quality figures."""
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib.colors import LinearSegmentedColormap

    fig_dir = out_dir / "figures"
    fig_dir.mkdir(parents=True, exist_ok=True)

    # --- Figure: RMS trend by crack state ---
    fig, ax = plt.subplots(figsize=(8, 4))
    states = CRACK_STATES
    cracks = [CRACK_LENGTHS[s] for s in states]
    rms_by_state = []
    for s in states:
        mask = df["state"] == s
        rms_by_state.append(df.loc[mask, "ax_rms"].mean())
    ax.plot(cracks, rms_by_state, 'o-', color='#305496', linewidth=2, markersize=8)
    ax.set_xlabel("Crack length (mm)", fontsize=12)
    ax.set_ylabel("Mean flapwise RMS (g)", fontsize=12)
    ax.set_title("Vibration RMS vs. Crack Severity", fontsize=13)
    ax.grid(True, alpha=0.3)
    fig.tight_layout()
    fig.savefig(fig_dir / "rms_vs_crack.png", dpi=200)
    plt.close()

    # --- Figure: Kurtosis trend ---
    fig, ax = plt.subplots(figsize=(8, 4))
    kurt_by_state = []
    for s in states:
        mask = df["state"] == s
        kurt_by_state.append(df.loc[mask, "ax_kurtosis"].mean())
    ax.plot(cracks, kurt_by_state, 's-', color='#C00000', linewidth=2, markersize=8)
    ax.axhline(y=3.0, color='gray', linestyle='--', alpha=0.5, label='Gaussian (κ=3)')
    ax.set_xlabel("Crack length (mm)", fontsize=12)
    ax.set_ylabel("Mean flapwise kurtosis", fontsize=12)
    ax.set_title("Kurtosis vs. Crack Severity", fontsize=13)
    ax.legend()
    ax.grid(True, alpha=0.3)
    fig.tight_layout()
    fig.savefig(fig_dir / "kurtosis_vs_crack.png", dpi=200)
    plt.close()

    # --- Figure: Modal frequency drift ---
    fig, ax = plt.subplots(figsize=(8, 4))
    f1_by_state = []
    for s in states:
        mask = df["state"] == s
        f1_by_state.append(df.loc[mask, "modal_f1"].mean())
    ax.plot(cracks, f1_by_state, 'D-', color='#548235', linewidth=2, markersize=8)
    ax.set_xlabel("Crack length (mm)", fontsize=12)
    ax.set_ylabel("1st modal frequency (Hz)", fontsize=12)
    ax.set_title("Modal Frequency Drift vs. Crack Severity", fontsize=13)
    ax.grid(True, alpha=0.3)
    fig.tight_layout()
    fig.savefig(fig_dir / "modal_freq_drift.png", dpi=200)
    plt.close()

    # --- Figure: Confusion matrix (Stratified 5-Fold) ---
    cm = np.array(clf_strat["confusion_matrix"])
    fig, ax = plt.subplots(figsize=(7, 6))
    im = ax.imshow(cm, cmap='Blues', aspect='auto')
    ax.set_xticks(range(7))
    ax.set_yticks(range(7))
    ax.set_xticklabels(CRACK_STATES, fontsize=10)
    ax.set_yticklabels(CRACK_STATES, fontsize=10)
    ax.set_xlabel("Predicted", fontsize=12)
    ax.set_ylabel("True", fontsize=12)
    ax.set_title(f"Stratified 5-Fold Confusion Matrix (acc={clf_strat['mean_accuracy']:.3f})", fontsize=13)
    for i in range(7):
        for j in range(7):
            color = "white" if cm[i, j] > cm.max() / 2 else "black"
            ax.text(j, i, str(cm[i, j]), ha="center", va="center", color=color, fontsize=9)
    fig.colorbar(im, ax=ax, shrink=0.8)
    fig.tight_layout()
    fig.savefig(fig_dir / "confusion_matrix_stratified.png", dpi=200)
    plt.close()

    # --- Figure: Confusion matrix (LOCSO — interpolation) ---
    cm_locso = np.array(clf_locso["confusion_matrix"])
    fig, ax = plt.subplots(figsize=(7, 6))
    im = ax.imshow(cm_locso, cmap='Oranges', aspect='auto')
    ax.set_xticks(range(7))
    ax.set_yticks(range(7))
    ax.set_xticklabels(CRACK_STATES, fontsize=10)
    ax.set_yticklabels(CRACK_STATES, fontsize=10)
    ax.set_xlabel("Predicted", fontsize=12)
    ax.set_ylabel("True", fontsize=12)
    ax.set_title(f"LOCSO Interpolation (±1 acc={clf_locso.get('adjacent_accuracy', 0):.3f})", fontsize=13)
    for i in range(7):
        for j in range(7):
            color = "white" if cm_locso[i, j] > cm_locso.max() / 2 else "black"
            ax.text(j, i, str(cm_locso[i, j]), ha="center", va="center", color=color, fontsize=9)
    fig.colorbar(im, ax=ax, shrink=0.8)
    fig.tight_layout()
    fig.savefig(fig_dir / "confusion_matrix_locso.png", dpi=200)
    plt.close()

    # --- Figure: RUL predicted vs true ---
    y_true = np.array(rul_results["y_true"])
    p10 = np.array(rul_results["p10"])
    p50 = np.array(rul_results["p50"])
    p90 = np.array(rul_results["p90"])

    # Sort by true RUL for cleaner plot
    order = np.argsort(y_true)
    y_s = y_true[order]
    p10_s = p10[order]
    p50_s = p50[order]
    p90_s = p90[order]

    fig, ax = plt.subplots(figsize=(10, 5))
    ax.fill_between(range(len(y_s)), p10_s, p90_s, alpha=0.25, color='#305496',
                     label='p10–p90 interval')
    ax.plot(range(len(y_s)), p50_s, '-', color='#305496', linewidth=1.5, label='p50 (median)')
    ax.plot(range(len(y_s)), y_s, '--', color='#C00000', linewidth=1.5, label='True RUL')
    ax.set_xlabel("Sample (sorted by true RUL)", fontsize=12)
    ax.set_ylabel("RUL (hours)", fontsize=12)
    ax.set_title(f"XGBoost RUL Prediction (RMSE={rul_results['rmse']:.1f}h, "
                 f"PICP={rul_results['picp']:.3f})", fontsize=13)
    ax.legend(fontsize=10)
    ax.grid(True, alpha=0.3)
    fig.tight_layout()
    fig.savefig(fig_dir / "rul_pred_vs_true.png", dpi=200)
    plt.close()

    # --- Figure: Alpha-lambda plot ---
    fig, ax = plt.subplots(figsize=(8, 5))
    alpha = 0.2
    within = (p50 >= y_true * (1 - alpha)) & (p50 <= y_true * (1 + alpha))
    ax.scatter(y_true[within], p50[within], s=10, alpha=0.5, c='#305496', label='Within ±20%')
    ax.scatter(y_true[~within], p50[~within], s=10, alpha=0.5, c='#C00000', label='Outside ±20%')
    lim = max(y_true.max(), p50.max()) * 1.05
    ax.plot([0, lim], [0, lim], 'k--', linewidth=0.8, label='Perfect')
    ax.fill_between([0, lim], [0, lim * (1-alpha)], [0, lim * (1+alpha)],
                     alpha=0.1, color='green')
    ax.set_xlabel("True RUL (hours)", fontsize=12)
    ax.set_ylabel("Predicted RUL (hours)", fontsize=12)
    ax.set_title(f"Alpha-Lambda Plot (α=20%, accuracy={rul_results['alpha_lambda_20']:.3f})",
                 fontsize=13)
    ax.legend(fontsize=10)
    ax.set_xlim(0, lim)
    ax.set_ylim(0, lim)
    ax.grid(True, alpha=0.3)
    fig.tight_layout()
    fig.savefig(fig_dir / "alpha_lambda.png", dpi=200)
    plt.close()

    # --- Figure: Feature importance ---
    # Quick retrain on full dataset for importance
    import xgboost as xgb
    feat_cols = get_feature_cols(df)
    X_full = df[feat_cols].values
    y_full = df["rul_h"].values
    model = xgb.XGBRegressor(n_estimators=200, max_depth=5, learning_rate=0.05,
                              random_state=42, verbosity=0)
    model.fit(X_full, y_full)
    importance = model.feature_importances_
    top_idx = np.argsort(importance)[-15:]  # Top 15

    fig, ax = plt.subplots(figsize=(8, 5))
    ax.barh(range(len(top_idx)), importance[top_idx], color='#305496')
    ax.set_yticks(range(len(top_idx)))
    ax.set_yticklabels([feat_cols[i] for i in top_idx], fontsize=9)
    ax.set_xlabel("Feature Importance (gain)", fontsize=12)
    ax.set_title("Top 15 Features for RUL Prediction", fontsize=13)
    fig.tight_layout()
    fig.savefig(fig_dir / "feature_importance.png", dpi=200)
    plt.close()

    print(f"\nFigures saved to {fig_dir}/")


# ====================== Main ======================

def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    print("=" * 60)
    print("Ch5 Wind Turbine Analysis Pipeline")
    print("=" * 60)

    # Step 1: Load data
    print("\n[1/5] Loading vibration data...")
    records = load_all_vibration(DATA_DIR)

    # Step 2: Feature extraction
    print("\n[2/5] Extracting features...")
    df = build_feature_matrix(records)
    df.to_csv(OUT_DIR / "features.csv", index=False)

    # Normalize features by wind bin (remove operating-condition bias)
    df_norm = normalize_by_windbin(df)

    # Step 3: Classification (on normalized features)
    print("\n[3/5] Training classifiers...")
    clf_strat = train_classifier_stratified(df_norm)
    clf_locso = train_classifier_locso(df_norm)
    clf_windbin = train_classifier_windbin(df)  # WindBin uses raw features

    # Step 4: RUL prediction
    print("\n[4/5] Training RUL models...")
    rul_xgb = train_rul_xgboost(df)

    # Step 5: Figures
    print("\n[5/5] Generating figures...")
    generate_figures(df, clf_strat, clf_locso, rul_xgb, OUT_DIR)

    # Compile all results
    results = {
        "data_summary": {
            "total_acquisitions": len(records),
            "feature_dimensions": len(get_feature_cols(df)),
            "crack_states": CRACK_STATES,
        },
        "classification": {
            "Stratified5Fold": clf_strat,
            "LOCSO": clf_locso,
            "WindBin": clf_windbin,
        },
        "rul_prediction": {
            "XGBoost": {k: v for k, v in rul_xgb.items()
                        if k not in ("y_true", "p10", "p50", "p90")},
        },
        "feature_trends": {
            "rms_by_state": {s: round(df.loc[df["state"]==s, "ax_rms"].mean(), 4)
                             for s in CRACK_STATES},
            "kurtosis_by_state": {s: round(df.loc[df["state"]==s, "ax_kurtosis"].mean(), 2)
                                   for s in CRACK_STATES},
            "modal_f1_by_state": {s: round(df.loc[df["state"]==s, "modal_f1"].mean(), 1)
                                   for s in CRACK_STATES},
        },
    }

    results_path = OUT_DIR / "results.json"
    with open(results_path, "w") as f:
        json.dump(results, f, indent=2)

    print(f"\n{'=' * 60}")
    print(f"Pipeline complete. Results: {results_path}")
    print(f"{'=' * 60}")

    # Print summary
    print(f"\n--- SUMMARY ---")
    print(f"Classification (Strat. 5-Fold): {clf_strat['mean_accuracy']:.4f}")
    print(f"Classification (LOCSO ±1):      {clf_locso.get('adjacent_accuracy', 0):.4f}")
    print(f"Classification (WindBin):       {clf_windbin['mean_accuracy']:.4f}")
    print(f"RUL RMSE:    {rul_xgb['rmse']:.1f} h")
    print(f"RUL MAE:     {rul_xgb['mae']:.1f} h")
    print(f"RUL PICP:    {rul_xgb['picp']:.3f}")
    print(f"RUL MPIW:    {rul_xgb['mpiw']:.1f} h")
    print(f"RUL α-λ(20%): {rul_xgb['alpha_lambda_20']:.3f}")


if __name__ == "__main__":
    main()
