from ml import kmeans, knn, loo_accuracy


def test_kmeans_separates():
    pts = [[1, 1], [1.2, 0.8], [5, 5], [5.1, 4.9]]
    lab, cents, _ = kmeans(pts, 2)
    assert lab[0] == lab[1] and lab[2] == lab[3] and lab[0] != lab[2]


def test_knn_and_loo():
    X = [[1, 1], [1.1, 1], [5, 5], [5.1, 5], [0.9, 1.2], [4.9, 5.2]]
    y = ["a", "a", "b", "b", "a", "b"]
    assert knn(X, y, [4.8, 4.8]) == "b"
    assert loo_accuracy(X, y) == 1.0
