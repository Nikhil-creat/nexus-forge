import math


def kmeans(pts, k, iters=50):
    cents = [list(pts[0])]
    while len(cents) < k:
        cents.append(list(max(pts, key=lambda p: min(math.dist(p, c) for c in cents))))
    lab = []
    for _ in range(iters):
        lab = [min(range(k), key=lambda i: math.dist(p, cents[i])) for p in pts]
        new = []
        for i in range(k):
            m = [p for p, l in zip(pts, lab) if l == i]
            new.append([sum(c) / len(m) for c in zip(*m)] if m else cents[i])
        if new == cents:
            break
        cents = new
    inertia = sum(math.dist(p, cents[l]) ** 2 for p, l in zip(pts, lab))
    return lab, cents, inertia


def knn(X, y, q, k=3):
    near = sorted(range(len(X)), key=lambda i: math.dist(X[i], q))[:k]
    votes = {}
    for i in near:
        votes[y[i]] = votes.get(y[i], 0) + 1 / (1e-9 + math.dist(X[i], q))
    return max(votes, key=votes.get)


def loo_accuracy(X, y, k=3):
    if len(X) < 3:
        return None
    hits = 0
    for i in range(len(X)):
        Xr, yr = X[:i] + X[i + 1:], y[:i] + y[i + 1:]
        hits += knn(Xr, yr, X[i], min(k, len(Xr))) == y[i]
    return round(hits / len(X), 3)
