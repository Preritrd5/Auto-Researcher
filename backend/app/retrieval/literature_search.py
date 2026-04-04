from __future__ import annotations

import urllib.parse
import xml.etree.ElementTree as ET
from dataclasses import dataclass

import httpx

from app.core.config import get_settings


@dataclass
class PaperCandidate:
    source: str
    external_id: str
    title: str
    authors: list[str]
    year: int | None
    url: str
    venue: str
    doi: str = ""


class LiteratureSearchService:
    def __init__(self) -> None:
        self.settings = get_settings()

    async def search(self, query: str, limit: int = 5) -> list[PaperCandidate]:
        results: list[PaperCandidate] = []
        try:
            results.extend(await self._search_arxiv(query, limit=max(2, limit // 2)))
        except Exception:
            pass
        try:
            results.extend(await self._search_crossref(query, limit=max(2, limit // 2)))
        except Exception:
            pass
        if self.settings.semantic_scholar_api_key:
            try:
                results.extend(await self._search_semantic_scholar(query, limit=limit))
            except Exception:
                pass
        deduped: dict[str, PaperCandidate] = {}
        for item in results:
            key = item.title.strip().lower()
            deduped.setdefault(key, item)
        return list(deduped.values())[:limit]

    async def _search_arxiv(self, query: str, limit: int) -> list[PaperCandidate]:
        url = (
            "https://export.arxiv.org/api/query?"
            f"search_query=all:{urllib.parse.quote(query)}&start=0&max_results={limit}"
        )
        async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
            response = await client.get(url)
            response.raise_for_status()
        root = ET.fromstring(response.text)
        ns = {"atom": "http://www.w3.org/2005/Atom"}
        items: list[PaperCandidate] = []
        for entry in root.findall("atom:entry", ns):
            title = (entry.findtext("atom:title", default="", namespaces=ns) or "").strip()
            paper_id = (entry.findtext("atom:id", default="", namespaces=ns) or "").strip()
            published = entry.findtext("atom:published", default="", namespaces=ns) or ""
            authors = [author.findtext("atom:name", default="", namespaces=ns) or "" for author in entry.findall("atom:author", ns)]
            items.append(
                PaperCandidate(
                    source="arxiv",
                    external_id=paper_id.rsplit("/", 1)[-1],
                    title=title,
                    authors=[name for name in authors if name],
                    year=int(published[:4]) if published[:4].isdigit() else None,
                    url=paper_id,
                    venue="arXiv",
                )
            )
        return items

    async def _search_crossref(self, query: str, limit: int) -> list[PaperCandidate]:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.get(
                "https://api.crossref.org/works",
                params={"query.title": query, "rows": limit},
            )
            response.raise_for_status()
            payload = response.json()
        items: list[PaperCandidate] = []
        for item in payload.get("message", {}).get("items", []):
            title = (item.get("title") or [""])[0]
            authors = [
                f"{author.get('given', '')} {author.get('family', '')}".strip()
                for author in item.get("author", [])
            ]
            year = None
            issued = item.get("issued", {}).get("date-parts", [])
            if issued and issued[0]:
                year = int(issued[0][0])
            items.append(
                PaperCandidate(
                    source="crossref",
                    external_id=item.get("DOI", ""),
                    title=title,
                    authors=[name for name in authors if name],
                    year=year,
                    url=item.get("URL", ""),
                    venue=(item.get("container-title") or [""])[0],
                    doi=item.get("DOI", ""),
                )
            )
        return items

    async def _search_semantic_scholar(self, query: str, limit: int) -> list[PaperCandidate]:
        headers = {"x-api-key": self.settings.semantic_scholar_api_key}
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.get(
                "https://api.semanticscholar.org/graph/v1/paper/search",
                headers=headers,
                params={
                    "query": query,
                    "limit": limit,
                    "fields": "title,authors,year,url,venue,externalIds",
                },
            )
            response.raise_for_status()
            payload = response.json()
        items: list[PaperCandidate] = []
        for item in payload.get("data", []):
            external_ids = item.get("externalIds") or {}
            items.append(
                PaperCandidate(
                    source="semantic_scholar",
                    external_id=str(external_ids.get("CorpusId", "")),
                    title=item.get("title", ""),
                    authors=[author.get("name", "") for author in item.get("authors", []) if author.get("name")],
                    year=item.get("year"),
                    url=item.get("url", ""),
                    venue=item.get("venue", ""),
                    doi=str(external_ids.get("DOI", "")),
                )
            )
        return items
