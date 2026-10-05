"""Check that phone line breaks stay separate and source notes survive."""

import sys
from unittest.mock import patch

from bs4 import BeautifulSoup

# The CLI crawler replaces stdout at import; keep the previous wrapper alive.
_stdout_wrapper = sys.stdout
from crawl_phone import crawl_phone_numbers, normalize_phone_info


def main() -> None:
    soup = BeautifulSoup(
        '<div class="phone-info"><div class="dept">교목처<br>교목팀</div>'
        '<div class="phone">02-3399-3328<br>02-3399-3334</div>'
        '<div class="desc">채플<br>문의</div></div>'
        '<div class="phone-info"><div class="dept">행정팀</div>'
        '<div class="phone">02-3399-1234 내선 2</div></div>',
        "html.parser",
    )
    with (
        patch("crawl_phone.require_env", return_value="https://www.syu.ac.kr/test/"),
        patch("crawl_phone.request_soup", return_value=soup),
        patch("crawl_phone.os.path.exists", return_value=False),
        patch("crawl_phone.write_json_atomic") as write_json,
    ):
        crawl_phone_numbers()
    output = write_json.call_args.args[1]
    assert output[0] == {
        "department": "교목처 교목팀",
        "phone": "02-3399-3328 02-3399-3334",
        "description": "채플 문의",
        "phoneNumbers": ["02-3399-3328", "02-3399-3334"],
    }
    assert output[1]["phone"] == "02-3399-1234 내선 2"
    assert output[1]["phoneNumbers"] == ["02-3399-1234"]
    numbers = ["02-1234-5678", "031-123-4567", "010-9876-5432", "051-987-6543"]
    for count in (1, 2, 3, 4):
        updated = normalize_phone_info({
            "department": "테스트 부서",
            "phone": " / ".join(numbers[:count]),
            "phoneNumbers": ["02-0000-0000"],
        })
        assert updated["phoneNumbers"] == numbers[:count]
    print("Validated phone crawler line breaks and source notes")


if __name__ == "__main__":
    main()
