"""Polymer Genomics API client.

Provides a clean Python interface to the Polymer Genomics REST API for
querying DNA biophysical properties, gene annotations, methylation data,
and curated genomic reference layers.

Usage::

    from polymer_genomics import PolymerClient

    client = PolymerClient(api_key="pk_live_...")
    report = client.evaluate("ATGCGATCGATCG...")
    print(report["flags"])
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

import httpx

from polymer_genomics.exceptions import (
    PolymerAPIError,
    PolymerAuthError,
    PolymerNotFoundError,
    PolymerRateLimitError,
    PolymerValidationError,
)

_DEFAULT_BASE_URL = "https://api.polymerbio.org"
_DEFAULT_TIMEOUT = 30.0


class PolymerClient:
    """Client for the Polymer Genomics API.

    Parameters
    ----------
    api_key : str, optional
        API key for authentication. If not provided, requests are sent
        without authentication (works for local dev servers).
    base_url : str
        Base URL of the API. Defaults to https://api.polymerbio.org.
    timeout : float
        Request timeout in seconds. Defaults to 30.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: str = _DEFAULT_BASE_URL,
        timeout: float = _DEFAULT_TIMEOUT,
    ):
        headers: Dict[str, str] = {"Accept": "application/json"}
        if api_key:
            headers["X-API-Key"] = api_key
        self._client = httpx.Client(
            base_url=base_url,
            headers=headers,
            timeout=timeout,
        )

    # ── Design Evaluation (Physics Linter) ──────────────────────────

    def evaluate(
        self,
        sequence: str,
        name: str = "unnamed",
        analysis: str = "full",
        salt_mm: float = 1000.0,
        window_size: int = 100,
    ) -> Dict[str, Any]:
        """Evaluate biophysical properties of a DNA sequence.

        This is the core product — a physics linter for DNA. Takes any
        sequence (10–100,000 bp) and returns thermodynamic stability,
        structural properties, CpG islands, and actionable flags.

        Parameters
        ----------
        sequence : str
            DNA sequence (ACGT, Ns tolerated).
        name : str
            Label for the sequence.
        analysis : str
            ``"full"`` (default), ``"thermodynamic"``, or ``"structural"``.
        salt_mm : float
            NaCl concentration in mM (1000 = standard, 150 = physiological).
        window_size : int
            Window size in bp for windowed profiles.

        Returns
        -------
        dict
            Keys: ``summary``, ``cpg_islands``, ``thermodynamics``,
            ``structural``, ``extinction``, ``flags``, ``flag_counts``.
        """
        return self._post("/v1/evaluate", json={
            "sequence": sequence,
            "name": name,
            "analysis": analysis,
            "salt_mm": salt_mm,
            "window_size": window_size,
        })

    def compare(
        self,
        sequences: Dict[str, str],
        analysis: str = "full",
        salt_mm: float = 1000.0,
        window_size: int = 100,
    ) -> Dict[str, Any]:
        """Compare biophysical properties of multiple DNA sequences.

        Evaluates 2–10 named sequences and returns per-sequence reports
        plus a delta table against the first (reference) sequence.

        Parameters
        ----------
        sequences : dict
            Mapping of names to DNA sequences. First entry is reference.
        analysis : str
            ``"full"``, ``"thermodynamic"``, or ``"structural"``.
        salt_mm : float
            NaCl concentration in mM.
        window_size : int
            Window size in bp.

        Returns
        -------
        dict
            Keys: ``comparison``, ``deltas_vs_reference``, ``evaluations``.
        """
        return self._post("/v1/compare", json={
            "sequences": sequences,
            "analysis": analysis,
            "salt_mm": salt_mm,
            "window_size": window_size,
        })

    def batch_evaluate(
        self,
        sequences: Dict[str, str],
        analysis: str = "full",
        salt_mm: float = 1000.0,
        window_size: int = 100,
    ) -> Dict[str, Any]:
        """Batch-evaluate up to 100 DNA sequences independently.

        Unlike ``compare()``, this does NOT compute deltas — each sequence
        is evaluated on its own. Designed for screening candidate libraries.

        Parameters
        ----------
        sequences : dict
            Mapping of names to DNA sequences. 1–100 sequences.
        analysis : str
            ``"full"``, ``"thermodynamic"``, or ``"structural"``.
        salt_mm : float
            NaCl concentration in mM.
        window_size : int
            Window size in bp.

        Returns
        -------
        dict
            Keys: ``summary``, ``evaluations``, optionally ``errors``.
        """
        return self._post("/v1/evaluate/batch", json={
            "sequences": sequences,
            "analysis": analysis,
            "salt_mm": salt_mm,
            "window_size": window_size,
        })

    # ── Construct Design (Module 5) ─────────────────────────────────

    def evaluate_construct(
        self,
        parts: List[Dict[str, str]],
        name: str = "construct",
        circular: bool = False,
        salt_mm: float = 150.0,
        analysis: str = "full",
    ) -> Dict[str, Any]:
        """Evaluate a multi-part DNA construct.

        Takes an ordered list of construct parts and returns per-part
        biophysical evaluation, junction analysis, and assembly flags.

        Parameters
        ----------
        parts : list of dict
            Each dict must have ``name`` (str), ``sequence`` (str), and
            optionally ``role`` (str: promoter, cds, utr5, utr3,
            terminator, backbone, linker, spacer, generic).
        name : str
            Label for the construct.
        circular : bool
            True for plasmid (evaluates closing junction).
        salt_mm : float
            NaCl in mM (150 = physiological default, 1000 = standard).
        analysis : str
            ``"full"`` (default), ``"thermodynamic"``, or ``"structural"``.

        Returns
        -------
        dict
            Keys: ``summary``, ``parts``, ``junctions``, ``assembly_flags``.
        """
        return self._post("/v1/design/construct", json={
            "parts": parts,
            "name": name,
            "circular": circular,
            "salt_mm": salt_mm,
            "analysis": analysis,
        })

    def compare_constructs(
        self,
        constructs: List[Dict[str, Any]],
        salt_mm: float = 150.0,
        analysis: str = "full",
    ) -> Dict[str, Any]:
        """Compare two or more construct designs side-by-side.

        Parameters
        ----------
        constructs : list of dict
            Each dict must have ``name`` (str), ``parts`` (list of part
            dicts), and optionally ``circular`` (bool).
        salt_mm : float
            NaCl in mM.
        analysis : str
            ``"full"``, ``"thermodynamic"``, or ``"structural"``.

        Returns
        -------
        dict
            Keys: ``comparison``, ``constructs``.
        """
        return self._post("/v1/design/construct/compare", json={
            "constructs": constructs,
            "salt_mm": salt_mm,
            "analysis": analysis,
        })

    # ── Gene Lookup ──────────────────────────────────────────────────

    def gene(self, build: str, symbol: str) -> Dict[str, Any]:
        """Look up a gene by symbol. Supports aliases (e.g., p53 → TP53)."""
        return self._get(f"/v1/genes/{build}/{symbol}")

    def gene_expression(self, build: str, symbol: str) -> Dict[str, Any]:
        """GTEx v10 expression across 54 tissues (TPM)."""
        return self._get(f"/v1/genes/{build}/{symbol}/expression")

    def gene_cost(self, build: str, symbol: str) -> Dict[str, Any]:
        """Biosynthetic cost — Akashi-Gojobori + expression-weighted (EWGC)."""
        return self._get(f"/v1/genes/{build}/{symbol}/cost")

    def gene_constraint(self, build: str, symbol: str) -> Dict[str, Any]:
        """gnomAD constraint metrics — pLI, LOEUF, Z-scores."""
        return self._get(f"/v1/genes/{build}/{symbol}/constraint")

    def gene_pathways(self, build: str, symbol: str) -> Dict[str, Any]:
        """Reactome pathway memberships."""
        return self._get(f"/v1/genes/{build}/{symbol}/pathways")

    def gene_sets(self, build: str, symbol: str) -> Dict[str, Any]:
        """MSigDB Hallmark gene set memberships."""
        return self._get(f"/v1/genes/{build}/{symbol}/gene-sets")

    def protein_abundance(self, build: str, symbol: str) -> Dict[str, Any]:
        """PaxDb tissue-specific protein abundance (PPM)."""
        return self._get(f"/v1/genes/{build}/{symbol}/protein-abundance")

    def protein_atlas(self, build: str, symbol: str) -> Dict[str, Any]:
        """Human Protein Atlas tissue expression + subcellular localization."""
        return self._get(f"/v1/genes/{build}/{symbol}/protein-atlas")

    # ── Region Queries ───────────────────────────────────────────────

    def region(
        self,
        build: str,
        region: str,
        layers: Optional[List[str]] = None,
        fields: Optional[List[str]] = None,
        cursor: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Query all features in a genomic region (GRanges format).

        Parameters
        ----------
        build : str
            ``"hg38"`` or ``"hg37"``.
        region : str
            Region string, e.g. ``"chr17:7668402-7687550"``.
        layers : list of str, optional
            Layer keys to query. Omit for all active layers.
        fields : list of str, optional
            mcols field names to return. Omit for all fields.
        cursor : str, optional
            Opaque pagination cursor from a previous response.
        """
        params: Dict[str, str] = {}
        if layers:
            params["layers"] = ",".join(layers)
        if fields:
            params["fields"] = ",".join(fields)
        if cursor:
            params["cursor"] = cursor
        return self._get(f"/v1/regions/{build}/{region}", params=params)

    def region_all(
        self,
        build: str,
        region: str,
        layers: Optional[List[str]] = None,
        fields: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """Auto-paginate through all results in a genomic region.

        Calls ``region()`` repeatedly, following pagination cursors until
        all data is retrieved. Returns a merged response.

        Parameters
        ----------
        build : str
            ``"hg38"`` or ``"hg37"``.
        region : str
            Region string.
        layers : list of str, optional
            Layer keys to query.
        fields : list of str, optional
            mcols field names to return.
        """
        result = self.region(build, region, layers=layers, fields=fields)
        all_data = dict(result.get("data", {}))

        # Follow cursors until no more pages
        pagination = result.get("pagination")
        while pagination:
            # Pick the first layer that has a next_cursor
            next_cursor = None
            for _layer_key, page_info in pagination.items():
                if page_info.get("next_cursor"):
                    next_cursor = page_info["next_cursor"]
                    break

            if not next_cursor:
                break

            page = self.region(
                build, region, layers=layers, fields=fields, cursor=next_cursor
            )

            # Merge data arrays
            for layer_key, layer_data in page.get("data", {}).items():
                if layer_key in all_data:
                    existing = all_data[layer_key]
                    for key in ("seqnames", "strand"):
                        if key in existing and key in layer_data:
                            existing[key].extend(layer_data[key])
                    if "ranges" in existing and "ranges" in layer_data:
                        for rk in ("start", "end", "width"):
                            if rk in existing["ranges"] and rk in layer_data["ranges"]:
                                existing["ranges"][rk].extend(layer_data["ranges"][rk])
                    if "mcols" in existing and "mcols" in layer_data:
                        for mk, mv in layer_data["mcols"].items():
                            if mk in existing["mcols"]:
                                existing["mcols"][mk].extend(mv)
                            else:
                                existing["mcols"][mk] = mv
                    existing["n"] = existing.get("n", 0) + layer_data.get("n", 0)
                else:
                    all_data[layer_key] = layer_data

            pagination = page.get("pagination")

        result["data"] = all_data
        result["status"] = "complete"
        result.pop("pagination", None)
        return result

    def stats(
        self,
        build: str,
        region: str,
        layers: Optional[List[str]] = None,
        fields: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """Get summary statistics for data layers in a region.

        Returns mean, median, sd, min, max, p25, p75 for continuous layers,
        or count + density for count-mode layers.

        Parameters
        ----------
        build : str
            ``"hg38"`` or ``"hg37"``.
        region : str
            Region string.
        layers : list of str, optional
            Layer keys to query.
        fields : list of str, optional
            Field names to include in stats.
        """
        params: Dict[str, str] = {}
        if layers:
            params["layers"] = ",".join(layers)
        if fields:
            params["fields"] = ",".join(fields)
        return self._get(f"/v1/stats/{build}/{region}", params=params)

    def sequence(self, build: str, region: str) -> Dict[str, Any]:
        """Get raw DNA sequence for a genomic region (max 100 kb)."""
        return self._get(f"/v1/sequence/{build}/{region}")

    def biophysics(
        self,
        build: str,
        region: str,
        properties: str = "all",
        salt_mm: float = 1000.0,
    ) -> Dict[str, Any]:
        """Compute per-dinucleotide biophysical properties for a genomic region.

        Returns stacking ΔG₃₇, extinction ε₂₆₀, groove geometry, and
        form propensity for each dinucleotide step. Max 10 kb.

        Parameters
        ----------
        build : str
            ``"hg38"`` or ``"hg37"``.
        region : str
            Region string (max 10,000 bp).
        properties : str
            Comma-separated or ``"all"``: thermodynamics, extinction,
            groove, form_propensity.
        salt_mm : float
            NaCl in mM.
        """
        return self._get(f"/v1/biophysics/{build}/{region}", params={
            "properties": properties,
            "salt_mm": str(salt_mm),
        })

    def aggregate(
        self,
        build: str,
        region: str,
        resolution: int = 10000,
        layers: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """Binned density/counts for large regions.

        Use this instead of ``region()`` for regions > 500 kb.
        """
        params: Dict[str, Any] = {"resolution": str(resolution)}
        if layers:
            params["layers"] = ",".join(layers)
        return self._get(f"/v1/aggregation/{build}/{region}", params=params)

    def proximity(
        self,
        build: str,
        gene: str,
        radius: int = 50000,
        layers: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """Get annotations around a gene (gene + radius, single call)."""
        params: Dict[str, Any] = {"build": build, "gene": gene, "radius": str(radius)}
        if layers:
            params["layers"] = ",".join(layers)
        return self._get("/v1/query", params=params)

    # ── Probe Queries ────────────────────────────────────────────────

    def probe(self, build: str, probe_id: str) -> Dict[str, Any]:
        """Look up a single methylation probe by ID."""
        return self._get(f"/v1/probes/{build}/{probe_id}")

    def batch_probes(self, build: str, probe_ids: List[str]) -> Dict[str, Any]:
        """Look up up to 10,000 methylation probes at once."""
        return self._post(f"/v1/probes/{build}/batch", json={"probe_ids": probe_ids})

    # ── Reference Data ───────────────────────────────────────────────

    def nn_parameters(self, duplex_type: str = "dna_dna") -> Dict[str, Any]:
        """SantaLucia/Xia/Sugimoto nearest-neighbor thermodynamic parameters."""
        return self._get("/v1/reference/nn-parameters", params={"duplex_type": duplex_type})

    def dinucleotide_properties(self) -> Dict[str, Any]:
        """Dinucleotide ε₂₆₀, groove geometry, A/Z-form propensity."""
        return self._get("/v1/reference/dinucleotide-properties")

    def amino_acid_properties(self) -> Dict[str, Any]:
        """Amino acid MW, volume, hydrophobicity, pKa, biosynthetic cost."""
        return self._get("/v1/reference/amino-acid-properties")

    def physical_constants(self) -> Dict[str, Any]:
        """DNA/protein physical constants (Lp, Manning ξ, elastic moduli, rates)."""
        return self._get("/v1/reference/physical-constants")

    def sbs_spectrum(self) -> Dict[str, Any]:
        """96-channel COSMIC SBS mutation spectrum with ΔG perturbation."""
        return self._get("/v1/reference/sbs-spectrum")

    def clock_probes(self, clock: Optional[str] = None) -> Dict[str, Any]:
        """Epigenetic clock probe coefficients (Horvath/Hannum/PhenoAge/GrimAge/DunedinPACE)."""
        params = {"clock": clock} if clock else {}
        return self._get("/v1/reference/clock-probes", params=params)

    # ── Search & Discovery ───────────────────────────────────────────

    def search(self, query: str, build: str = "hg38") -> Dict[str, Any]:
        """Prefix-match gene search (supports aliases)."""
        return self._get("/v1/search", params={"q": query, "build": build})

    def layers(
        self,
        build: Optional[str] = None,
        layer_type: Optional[str] = None,
    ) -> Dict[str, Any]:
        """List all available data layers with epistemic metadata."""
        params: Dict[str, str] = {}
        if build:
            params["build"] = build
        if layer_type:
            params["type"] = layer_type
        return self._get("/v1/layers", params=params)

    # ── Platform & Profile ──────────────────────────────────────────

    def platform_summary(self) -> Dict[str, Any]:
        """Platform-wide statistics (total layers, rows, builds)."""
        return self._get("/v1/stats/summary")

    def region_profile(
        self,
        build: str,
        region: str,
        include_negative: bool = False,
    ) -> Dict[str, Any]:
        """Comprehensive profile of a region across all data layers.

        Returns feature counts per layer, significance flags, and
        optionally negative annotations (layers with no features).

        Parameters
        ----------
        build : str
            ``"hg38"`` or ``"hg37"``.
        region : str
            Region string (max 1 Mb).
        include_negative : bool
            Include layers with no features in the region.
        """
        params: Dict[str, str] = {}
        if include_negative:
            params["include_negative"] = "true"
        return self._get(f"/v1/profile/{build}/{region}", params=params)

    def layer_license(self, layer_key: str) -> Dict[str, Any]:
        """Full license, citation, and provenance for a data layer."""
        return self._get(f"/v1/layers/{layer_key}/license")

    def recipes(self) -> Dict[str, Any]:
        """List available cross-layer query recipes."""
        return self._get("/v1/query/recipes")

    def recipe(self, recipe_key: str) -> Dict[str, Any]:
        """Get a specific recipe with full filter specification."""
        return self._get(f"/v1/query/recipe/{recipe_key}")

    # ── Advanced ─────────────────────────────────────────────────────

    def correlate(
        self,
        build: str,
        region: str,
        layer_a: str,
        layer_b: str,
        stat: str = "pearson",
        resolution: int = 10000,
        field_a: str = "density",
        field_b: str = "density",
    ) -> Dict[str, Any]:
        """Cross-layer correlation for a genomic region."""
        return self._get(f"/v1/correlate/{build}/{region}", params={
            "layer_a": layer_a,
            "layer_b": layer_b,
            "stat": stat,
            "resolution": str(resolution),
            "field_a": field_a,
            "field_b": field_b,
        })

    def intersect(
        self,
        build: str,
        region: str,
        filters: List[Dict[str, Any]],
        return_layers: Optional[List[str]] = None,
        limit: int = 1000,
    ) -> Dict[str, Any]:
        """Find positions satisfying multiple cross-layer conditions."""
        return self._post("/v1/query/intersect", json={
            "build": build,
            "region": region,
            "filters": filters,
            "return_layers": return_layers,
            "limit": limit,
        })

    # ── Probes + Biophysics ─────────────────────────────────────────

    def annotate_probes_biophysics(
        self,
        build: str,
        probe_ids: List[str],
        *,
        include_flags: bool = True,
    ) -> Dict[str, Any]:
        """Annotate probes with biophysical context (stacking energy, curvature, CpG context)."""
        return self._post(f"/v1/probes/{build}/biophysics", json={
            "probe_ids": probe_ids,
            "include_flags": include_flags,
        })

    def cpg_profile(self, build: str, query: str) -> Dict[str, Any]:
        """Comprehensive CpG site or probe dossier."""
        return self._get(f"/v1/cpg-profile/{build}/{query}")

    def probe_repeat_overlap(
        self, build: str, probe_id: str,
    ) -> Dict[str, Any]:
        """Check if a probe overlaps transposable element repeats."""
        return self._get("/v1/reference/probe-repeat-overlap", params={
            "probe_id": probe_id,
            "build": build,
        })

    # ── Gene Profiles & Similarity ───────────────────────────────────

    def gene_profile(self, build: str, symbol: str) -> Dict[str, Any]:
        """Gene profile with anomaly detection across layers."""
        return self._get(f"/v1/genes/{build}/{symbol}/profile")

    def similar_genes(
        self,
        build: str,
        symbol: str,
        *,
        mode: str = "integrated",
        limit: int = 20,
    ) -> Dict[str, Any]:
        """Find genes with similar biophysical/expression profiles."""
        return self._get(f"/v1/genes/{build}/{symbol}/similar", params={
            "mode": mode,
            "limit": str(limit),
        })

    # ── Transposable Elements ────────────────────────────────────────

    def transposome_families(self) -> Dict[str, Any]:
        """List all transposable element families."""
        return self._get("/v1/transposome/families")

    def transposome_family(self, family_id: str) -> Dict[str, Any]:
        """Get details for a specific TE family."""
        return self._get(f"/v1/transposome/family/{family_id}")

    # ── Layers & Bulk Data ───────────────────────────────────────────

    def layer_summary(self, build: str) -> Dict[str, Any]:
        """Summary statistics for all layers in a build."""
        return self._get(f"/v1/layers/summary/{build}")

    def bulk_download(self, layer_key: str) -> Dict[str, Any]:
        """Get a presigned download URL for a layer's bulk data."""
        return self._get(f"/v1/bulk/{layer_key}")

    # ── Internal ─────────────────────────────────────────────────────

    def _get(self, path: str, params: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
        resp = self._client.get(path, params=params)
        self._handle_error(resp)
        return resp.json()

    def _post(self, path: str, json: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        resp = self._client.post(path, json=json)
        self._handle_error(resp)
        return resp.json()

    @staticmethod
    def _handle_error(resp: httpx.Response) -> None:
        if resp.status_code < 400:
            return
        try:
            body = resp.json()
            msg = body.get("error", {}).get("message", resp.text)
        except Exception:
            msg = resp.text

        if resp.status_code == 401:
            raise PolymerAuthError(msg)
        elif resp.status_code == 403:
            raise PolymerAuthError(msg)
        elif resp.status_code == 404:
            raise PolymerNotFoundError(msg)
        elif resp.status_code == 422:
            raise PolymerValidationError(msg)
        elif resp.status_code == 429:
            raise PolymerRateLimitError(msg)
        else:
            raise PolymerAPIError(resp.status_code, msg)

    def close(self) -> None:
        """Close the underlying HTTP connection."""
        self._client.close()

    def __enter__(self) -> "PolymerClient":
        return self

    def __exit__(self, *args: Any) -> None:
        self.close()

    def __repr__(self) -> str:
        return f"PolymerClient(base_url={self._client.base_url!r})"
