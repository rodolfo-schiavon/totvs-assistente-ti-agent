from services.prediction_service import forecast_next, linear_trend


def test_linear_trend():
    assert linear_trend([1, 2, 3, 4]) > 4


def test_forecast_next():
    assert forecast_next([10, 12, 14]) >= 14
