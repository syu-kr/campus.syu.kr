# -*- coding: utf-8 -*-
"""장학공지 크롤링 스크립트."""

import io
import sys

from crawler_utils import NoticeCrawlerConfig, crawl_notice_board, require_env

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")


def crawl_scholarship_notice():
    crawl_notice_board(
        NoticeCrawlerConfig(
            category="scholarship",
            label="장학공지",
            base_url=require_env("CRAWL_SCHOLARSHIP_NOTICES_URL"),
            output_path="public/data/announcements-scholarship.json",
            default_author="장학팀",
            important_markers=("[공지]", "[중요]", "[필독]"),
            max_pages=128,
        )
    )


if __name__ == "__main__":
    crawl_scholarship_notice()
