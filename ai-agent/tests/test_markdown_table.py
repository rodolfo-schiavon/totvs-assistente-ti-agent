from services.markdown_table import parse_markdown_table, table_to_volume_compare


def test_parse_markdown_table():
    md = """
| Período (Semana) | Chamados Abertos | Chamados Fechados |
| --- | --- | --- |
| Semana de 03-08 | 1 | 0 |
| Semana de 10-15 | 2 | 1 |
"""
    rows = parse_markdown_table(md)
    assert rows is not None
    assert len(rows) == 2
    vol = table_to_volume_compare(rows)
    assert vol[0]["opened"] == 1
    assert vol[1]["closed"] == 1
