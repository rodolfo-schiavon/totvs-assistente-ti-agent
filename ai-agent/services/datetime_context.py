import os
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

TZ = ZoneInfo(os.getenv("AGENT_TIMEZONE", "America/Sao_Paulo"))

_MONTHS_PT = (
    "janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
)
_WEEKDAYS_PT = (
    "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira",
    "sexta-feira", "sábado", "domingo",
)


def _fmt(d: date) -> str:
    return d.strftime("%Y-%m-%d")


def _fmt_br(d: date) -> str:
    return f"{d.day:02d}/{d.month:02d}/{d.year}"


def _month_start(d: date) -> date:
    return d.replace(day=1)


def _month_end(d: date) -> date:
    if d.month == 12:
        return d.replace(year=d.year + 1, month=1, day=1) - timedelta(days=1)
    return d.replace(month=d.month + 1, day=1) - timedelta(days=1)


def _add_months(d: date, months: int) -> date:
    m = d.month - 1 + months
    y = d.year + m // 12
    m = m % 12 + 1
    day = min(d.day, _month_end(date(y, m, 1)).day)
    return date(y, m, day)


def build_datetime_context(ref: datetime | None = None) -> str:
    now = (ref or datetime.now(TZ)).astimezone(TZ)
    today = now.date()
    yesterday = today - timedelta(days=1)
    tomorrow = today + timedelta(days=1)

    week_start = today - timedelta(days=today.weekday())
    week_end = week_start + timedelta(days=6)
    last_week_start = week_start - timedelta(days=7)
    last_week_end = last_week_start + timedelta(days=6)
    next_week_start = week_start + timedelta(days=7)
    next_week_end = next_week_start + timedelta(days=6)

    this_month_start = _month_start(today)
    this_month_end = _month_end(today)
    last_month_end = this_month_start - timedelta(days=1)
    last_month_start = _month_start(last_month_end)
    next_month_start = this_month_end + timedelta(days=1)
    next_month_end = _month_end(next_month_start)
    next_3m_end = _month_end(_add_months(next_month_start, 2))

    last_year_start = date(today.year - 1, 1, 1)
    last_year_end = date(today.year - 1, 12, 31)
    this_year_start = date(today.year, 1, 1)

    weekday = _WEEKDAYS_PT[today.weekday()]
    month_name = _MONTHS_PT[today.month - 1]

    return f"""Referência temporal (fuso {TZ.key}):
- Agora: {now.strftime("%d/%m/%Y %H:%M:%S")} ({weekday})
- Hoje: {_fmt_br(today)} ({_fmt(today)})
- Ontem: {_fmt_br(yesterday)} ({_fmt(yesterday)})
- Amanhã: {_fmt_br(tomorrow)} ({_fmt(tomorrow)})
- Esta semana: {_fmt(week_start)} a {_fmt(week_end)}
- Semana passada: {_fmt(last_week_start)} a {_fmt(last_week_end)}
- Próxima semana: {_fmt(next_week_start)} a {_fmt(next_week_end)}
- Este mês ({month_name}/{today.year}): {_fmt(this_month_start)} a {_fmt(this_month_end)}
- Mês passado: {_fmt(last_month_start)} a {_fmt(last_month_end)}
- Próximo mês: {_fmt(next_month_start)} a {_fmt(next_month_end)}
- Próximos 3 meses: {_fmt(next_month_start)} a {_fmt(next_3m_end)}
- Ano passado ({today.year - 1}): {_fmt(last_year_start)} a {_fmt(last_year_end)}
- Ano corrente ({today.year}): {_fmt(this_year_start)} a {_fmt(today)}

Presets de período nas tools (period_preset):
- "today" → hoje | "yesterday" → ontem | "7d" → últimos 7 dias
- "1m" → último mês | "3m" → últimos 3 meses | "6m" → últimos 6 meses | "all" → tudo

Para intervalos customizados (ex.: semana passada, mês passado, ano passado), use date_from e date_to no formato YYYY-MM-DD conforme as datas acima."""
