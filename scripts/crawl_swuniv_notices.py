# -*- coding: utf-8 -*-
"""SW중심대학사업단 공지 크롤링 스크립트."""

import io
import sys

from crawler_utils import NoticeCrawlerConfig, crawl_notice_board, require_env

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")


def crawl_swuniv_notices():
    crawl_notice_board(
        NoticeCrawlerConfig(
            category="sw",
            label="SW중심대학 공지",
            base_url=require_env("CRAWL_SWUNIV_NOTICES_URL"),
            output_path="public/data/announcements-sw.json",
            default_author="SW중심대학사업단",
            max_pages=64,
        )
    )


if __name__ == "__main__":
    crawl_swuniv_notices()
