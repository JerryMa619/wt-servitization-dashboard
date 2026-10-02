"""Window/trend ridge baseline adapted from the local Chapter 5 analysis.
See docs/cmapss/DATA.md for provenance and calibration differences.
"""
import numpy as np
RUL_CAP = 125.0
WINDOW = 30
RIDGE_LAMBDA = 10.0

def units(arr):
    return [int(x) for x in np.unique(arr[:, 0])]

def rows_for(arr, uid):
    return arr[arr[:, 0] == uid]

def kmeans(x, k, iterations=50):
    if k == 1:
        return np.mean(x, axis=0, keepdims=True)
    order = np.argsort(x[:, 0])
    starts = np.linspace(0, len(order) - 1, k).astype(int)
    centres = x[order[starts]].copy()
    for _ in range(iterations):
        labels = np.argmin(((x[:, None, :] - centres[None, :, :]) ** 2).sum(axis=2), axis=1)
        new = centres.copy()
        for j in range(k):
            if np.any(labels == j):
                new[j] = x[labels == j].mean(axis=0)
        if np.max(np.abs(new - centres)) < 1e-8:
            break
        centres = new
    return centres

def fit_normaliser(train, n_conditions):
    ops = train[:, 2:5]
    op_mean = ops.mean(axis=0)
    op_std = ops.std(axis=0)
    op_std[op_std < 1e-8] = 1.0
    ops_z = (ops - op_mean) / op_std
    centres = kmeans(ops_z, n_conditions)
    labels = np.argmin(((ops_z[:, None, :] - centres[None, :, :]) ** 2).sum(axis=2), axis=1)
    sensors = train[:, 5:26]
    global_std = sensors.std(axis=0)
    selected = np.where(global_std > 1e-8)[0]
    means, stds = [], []
    for j in range(n_conditions):
        sj = sensors[labels == j][:, selected]
        means.append(sj.mean(axis=0))
        st = sj.std(axis=0)
        st[st < 1e-8] = 1.0
        stds.append(st)
    return {
        "op_mean": op_mean, "op_std": op_std, "centres": centres,
        "sensor_idx": selected, "means": np.array(means), "stds": np.array(stds),
    }

def transform_rows(rows, norm):
    ops_z = (rows[:, 2:5] - norm["op_mean"]) / norm["op_std"]
    labels = np.argmin(((ops_z[:, None, :] - norm["centres"][None, :, :]) ** 2).sum(axis=2), axis=1)
    sensors = rows[:, 5:26][:, norm["sensor_idx"]]
    z = np.empty_like(sensors)
    for i, lab in enumerate(labels):
        z[i] = (sensors[i] - norm["means"][lab]) / norm["stds"][lab]
    return ops_z, z

def endpoint_feature(rows, cutoff, norm):
    rows = rows[:cutoff]
    ops_z, z = transform_rows(rows, norm)
    w = z[-WINDOW:]
    n = len(w)
    x = np.arange(n, dtype=float)
    x -= x.mean()
    denom = np.sum(x * x) if n > 1 else 1.0
    slope = (x[:, None] * (w - w.mean(axis=0))).sum(axis=0) / denom
    delta = w[-1] - w[0]
    cycle_scaled = np.array([rows[-1, 1] / 400.0])
    return np.concatenate([z[-1], w.mean(axis=0), w.std(axis=0), slope, delta, ops_z[-1], cycle_scaled])

def build_training(arr, norm, allowed_units=None, stride=5):
    xs, ys = [], []
    allowed = set(allowed_units) if allowed_units is not None else set(units(arr))
    for uid in units(arr):
        if uid not in allowed:
            continue
        r = rows_for(arr, uid)
        max_cycle = r[-1, 1]
        cutoffs = list(range(max(5, min(WINDOW, len(r))), len(r) + 1, stride))
        if cutoffs[-1] != len(r):
            cutoffs.append(len(r))
        for cutoff in cutoffs:
            xs.append(endpoint_feature(r, cutoff, norm))
            ys.append(min(RUL_CAP, max_cycle - r[cutoff - 1, 1]))
    return np.asarray(xs), np.asarray(ys)

def standardise_fit(x):
    mean = x.mean(axis=0)
    std = x.std(axis=0)
    std[std < 1e-8] = 1.0
    return mean, std

def ridge_fit(x, y, lam=RIDGE_LAMBDA):
    mean, std = standardise_fit(x)
    z = (x - mean) / std
    z = np.column_stack([np.ones(len(z)), z])
    reg = np.eye(z.shape[1]) * lam
    reg[0, 0] = 0.0
    beta = np.linalg.solve(z.T @ z + reg, z.T @ y)
    return {"mean": mean, "std": std, "beta": beta}

def predict(model, x):
    z = (np.atleast_2d(x) - model["mean"]) / model["std"]
    z = np.column_stack([np.ones(len(z)), z])
    return np.clip(z @ model["beta"], 0.0, RUL_CAP)
