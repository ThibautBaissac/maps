"""Fit display px -> local metres (affine, least squares), print residuals and predictions."""
import json
import sys

import numpy as np

CP = json.load(open(sys.argv[1]))  # {name: [dx, dy, mx, my]}
names = list(CP)
A = np.array([[CP[n][0], CP[n][1], 1] for n in names])
M = np.array([[CP[n][2], CP[n][3]] for n in names])
coef, *_ = np.linalg.lstsq(A, M, rcond=None)
res = A @ coef - M
for n, r in zip(names, res):
    print(f'{n:28s} residual {np.hypot(*r):6.1f} m')
print('rms', round(float(np.sqrt((res ** 2).sum(1).mean())), 1), 'm')
(a, b), (c, d), (e, f) = coef
print('scale m/px', round(float(np.sqrt(abs(a * d - b * c))), 4), 'rotation deg', round(float(np.degrees(np.arctan2(b, a))), 2))
json.dump(coef.tolist(), open(sys.argv[2], 'w'))
inv = np.linalg.inv(np.array([[a, b, 0], [c, d, 0], [e, f, 1]]))
for spec in sys.argv[3:]:
    name, mx, my = spec.split('=')[0], *map(float, spec.split('=')[1].split(','))
    p = np.array([mx, my, 1]) @ inv
    print('predict', name, p[:2].round(1))
