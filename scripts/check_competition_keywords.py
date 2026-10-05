"""Check department candidate keywords against the same cases as the website."""

import json
import os
from pathlib import Path
from unittest.mock import patch

from crawl_department_notices import COMPETITION_SEARCH_TERMS, is_competition_notice, read_csv_env


def main() -> None:
    fixture_path = Path(__file__).resolve().parents[1] / "tests/fixtures/competition-keywords.json"
    fixtures = json.loads(fixture_path.read_text(encoding="utf-8"))
    for fixture in fixtures:
        expected = fixture["kind"] is not None
        assert is_competition_notice(fixture) == expected, fixture["title"]
    assert len(COMPETITION_SEARCH_TERMS) <= 8, "Default search queries exceeded the crawler request budget"
    variable = "CRAWL_DEPARTMENT_NOTICE_SEARCH_TERMS"
    with patch.dict(os.environ, {variable: "공모,대회,경진,해커톤"}):
        assert read_csv_env(variable, COMPETITION_SEARCH_TERMS) == list(COMPETITION_SEARCH_TERMS)
    with patch.dict(os.environ, {variable: "공모,데이터톤"}):
        assert read_csv_env(variable, COMPETITION_SEARCH_TERMS) == ["공모", "데이터톤"]
    print(f"Validated {len(fixtures)} shared competition keyword cases")


if __name__ == "__main__":
    main()
