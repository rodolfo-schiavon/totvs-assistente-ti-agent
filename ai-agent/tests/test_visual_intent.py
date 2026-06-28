from services.visual_intent import analyze_visual_intent, wants_explicit_visual


def test_explicit_visual_graph_request():
    assert wants_explicit_visual("me mostre um gráfico com os chamados abertos")
    assert wants_explicit_visual("apresente isso em grafico/relatorio")


def test_volume_compare_from_comparative():
    intent = analyze_visual_intent("quero um comparativo entre chamados abertos e fechados nos ultimos 03 meses")
    assert intent.explicit is False
    assert "volume_compare" in intent.kinds
    assert intent.period_preset == "3m"


def test_explicit_followup_uses_history():
    intent = analyze_visual_intent(
        "apresente isso em grafico/relatorio",
        prior_human=[
            "quero um comparativo entre chamados abertos e fechados nos ultimos 03 meses",
        ],
    )
    assert intent.explicit is True
    assert "volume_compare" in intent.kinds
    assert intent.period_preset == "3m"


def test_simple_count_does_not_force_chart():
    intent = analyze_visual_intent("quantos chamados abertos temos hoje?")
    assert intent.explicit is False
    assert intent.kinds == []


def test_graph_opened_last_months():
    intent = analyze_visual_intent("me mostre um grafico com os chamados abertos nos ultimos 03 meses")
    assert intent.explicit is True
    assert intent.period_preset == "3m"
    assert "volume_opened" in intent.kinds or "volume_compare" in intent.kinds
