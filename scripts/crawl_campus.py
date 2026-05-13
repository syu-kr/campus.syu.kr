# -*- coding: utf-8 -*-
"""캠퍼스 생활공지 크롤링 스크립트."""

import io
import sys

from crawler_utils import NoticeCrawlerConfig, crawl_notice_board, require_env

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")


def crawl_campus_notices():
    crawl_notice_board(
        NoticeCrawlerConfig(
            category="campus",
            label="캠퍼스 생활공지",
            base_url=require_env("CRAWL_CAMPUS_NOTICES_URL"),
            output_path="public/data/announcements-campus-life.json",
            default_author="학생생활팀",
            max_pages=128,
        )
    )


if __name__ == "__main__":
    crawl_campus_notices()
