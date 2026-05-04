# -*- coding: utf-8 -*-
"""행사공지 크롤링 스크립트."""

import io
import sys

from crawler_utils import NoticeCrawlerConfig, crawl_notice_board

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")


def crawl_event_notices():
    crawl_notice_board(
        NoticeCrawlerConfig(
            category="event",
            label="행사공지",
            base_url="https://www.syu.ac.kr/university-square/notice/event/page",
            output_path="public/data/announcements-events.json",
            default_author="행사팀",
            max_pages=128,
        )
    )


if __name__ == "__main__":
    crawl_event_notices()
