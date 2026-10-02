"""Verify that future observations cannot affect prefix-only inference."""
import sys
from pathlib import Path
import numpy as np
from baseline import fit_normaliser, build_training, ridge_fit, endpoint_feature, predict, rows_for
source=Path(sys.argv[1])
train=np.loadtxt(source/'train_FD001.txt');test=np.loadtxt(source/'test_FD001.txt')
norm=fit_normaliser(train,1);x,y=build_training(train,norm);model=ridge_fit(x,y)
r=rows_for(test,34);cutoff=80
before=endpoint_feature(r,cutoff,norm)
changed=r.copy();changed[cutoff:,2:]=1e8
np.testing.assert_array_equal(before,endpoint_feature(changed,cutoff,norm))
np.testing.assert_allclose(predict(model,before),predict(model,endpoint_feature(r[:cutoff],cutoff,norm)))
print('PASS: future-row mutation and prefix truncation leave features/prediction unchanged.')
