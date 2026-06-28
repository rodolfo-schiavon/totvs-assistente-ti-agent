def linear_trend(values: list[float]) -> float:
    if len(values) < 2:
        return values[-1] if values else 0.0
    n = len(values)
    xs = list(range(n))
    x_mean = sum(xs) / n
    y_mean = sum(values) / n
    num = sum((xs[i] - x_mean) * (values[i] - y_mean) for i in range(n))
    den = sum((x - x_mean) ** 2 for x in xs) or 1
    slope = num / den
    return values[-1] + slope


def forecast_next(values: list[int]) -> int:
    if not values:
        return 0
    return max(0, int(round(linear_trend([float(v) for v in values]))))
