"""Compute tool definitions for the Polymer Methylation Pipeline.

These tools extend the existing reference MCP server with local R-based
methylation analysis capabilities. Each tool calls a bundled R script via
subprocess with JSON I/O.

Registered by server.py on the shared FastMCP instance.
"""

from __future__ import annotations

from mcp.server.fastmcp import FastMCP

from .compute import (
    call_r,
    cleanup_session,
    create_session,
    list_sessions,
    r_available,
    session_dir,
)


def register_compute_tools(mcp: FastMCP) -> None:
    """Register all compute tools on the MCP server instance."""

    @mcp.tool()
    async def load_idats(
        idat_directory: str,
        sample_sheet: str | None = None,
    ) -> dict:
        """Load Illumina IDAT files and create an analysis session.

        Reads paired Red/Green IDAT files from a directory, auto-detects array
        type (450K, EPIC, EPICv2), and runs initial QC (detection p-values).

        This is always the FIRST step. Returns a session_id used by all
        subsequent tools.

        PREREQUISITES: Local R with minfi installed.

        Args:
            idat_directory: Path to directory containing .idat files (searched recursively).
            sample_sheet: Optional path to SampleSheet.csv. Auto-detected if omitted.
        """
        if not r_available():
            return {
                "error": "R is not installed. Compute tools require R + Bioconductor.",
                "install_instructions": (
                    "Rscript -e \"install.packages('BiocManager'); "
                    "BiocManager::install(c('minfi','sesame','limma'))\""
                ),
                "docker_alternative": "docker run polymerbio/methylation-toolkit",
            }
        sid = create_session()
        args = {
            "session_dir": str(session_dir(sid)),
            "idat_directory": idat_directory,
            "sample_sheet": sample_sheet,
        }
        result = await call_r("load_idats", args, timeout=600)
        return result

    @mcp.tool()
    async def normalize(
        session_id: str,
        method: str = "funnorm",
    ) -> dict:
        """Normalize methylation data within an analysis session.

        Applies the chosen normalization method to the raw RGChannelSet.
        Run after load_idats.

        Available methods:
        - opensesame: SeSAMe openSesame (canonical for EPICv2, recommended)
        - funnorm: Functional normalization (default, good for 450K/EPIC)
        - quantile: Quantile normalization
        - noob: Normal-exponential out-of-band
        - raw: No normalization

        Args:
            session_id: Session ID from load_idats.
            method: Normalization method. Default 'funnorm'.
        """
        args = {
            "session_dir": str(session_dir(session_id)),
            "method": method,
        }
        return await call_r("normalize", args, timeout=600)

    @mcp.tool()
    async def filter_probes(
        session_id: str,
        remove_snp: bool = True,
        remove_sex: bool = True,
        remove_crossreactive: bool = True,
        detection_threshold: float = 0.01,
    ) -> dict:
        """Filter probes by QC criteria.

        Removes failed, SNP-associated, sex chromosome, and cross-reactive
        probes. Run after normalize.

        Returns counts of probes removed at each step.

        Args:
            session_id: Session ID from load_idats.
            remove_snp: Remove probes at known SNP positions. Default True.
            remove_sex: Remove sex chromosome probes. Default True.
            remove_crossreactive: Remove cross-reactive probes (maxprobes). Default True.
            detection_threshold: Detection p-value threshold. Default 0.01.
        """
        args = {
            "session_dir": str(session_dir(session_id)),
            "remove_snp": remove_snp,
            "remove_sex": remove_sex,
            "remove_crossreactive": remove_crossreactive,
            "detection_threshold": detection_threshold,
        }
        return await call_r("filter_probes", args, timeout=300)

    @mcp.tool()
    async def run_limma(
        session_id: str,
        group_column: str,
        contrast: str | None = None,
        covariates: list[str] | None = None,
        fdr: float = 0.05,
    ) -> dict:
        """Run differential methylation analysis with limma.

        Performs limma eBayes on M-values with the specified group contrast.
        Run after filter_probes.

        Returns top hits and writes full results to dmps.csv in the session.

        For two-group comparisons, contrast is auto-generated. For >2 groups,
        provide an explicit contrast (e.g., 'TET2_mut-WT').

        Args:
            session_id: Session ID from load_idats.
            group_column: Column name in sample sheet defining groups.
            contrast: Explicit contrast string (e.g., 'TET2_mut-WT'). Auto-detected for 2 groups.
            covariates: Optional list of covariate column names (e.g., ['Age', 'Sex']).
            fdr: FDR threshold for significance counting. Default 0.05.
        """
        args = {
            "session_dir": str(session_dir(session_id)),
            "group_column": group_column,
            "contrast": contrast,
            "covariates": covariates,
            "fdr": fdr,
        }
        return await call_r("run_limma", args, timeout=600)

    @mcp.tool()
    async def get_betas(
        session_id: str,
        probes: list[str] | None = None,
    ) -> dict:
        """Get beta values (methylation levels 0-1) from the session.

        For a small number of probes (<=100), returns values inline.
        For larger requests, writes to CSV and returns the file path.

        Args:
            session_id: Session ID from load_idats.
            probes: Optional list of probe IDs. Returns all probes if omitted.
        """
        args = {
            "session_dir": str(session_dir(session_id)),
            "value_type": "beta",
            "probes": probes,
        }
        return await call_r("get_values", args, timeout=120)

    @mcp.tool()
    async def get_m_values(
        session_id: str,
        probes: list[str] | None = None,
    ) -> dict:
        """Get M-values (log2 ratio, used for statistics) from the session.

        For a small number of probes (<=100), returns values inline.
        For larger requests, writes to CSV and returns the file path.

        Args:
            session_id: Session ID from load_idats.
            probes: Optional list of probe IDs. Returns all probes if omitted.
        """
        args = {
            "session_dir": str(session_dir(session_id)),
            "value_type": "m",
            "probes": probes,
        }
        return await call_r("get_values", args, timeout=120)

    @mcp.tool()
    async def volcano_plot(
        session_id: str,
        fdr: float = 0.05,
        deltabeta: float = 0.1,
    ) -> dict:
        """Generate a volcano plot from differential methylation results.

        Creates SVG and PNG volcano plots showing significance vs effect size.
        Run after run_limma.

        Returns base64-encoded PNG for inline display.

        Args:
            session_id: Session ID from load_idats.
            fdr: FDR threshold for significance line. Default 0.05.
            deltabeta: Delta-beta threshold for effect size lines. Default 0.1.
        """
        args = {
            "session_dir": str(session_dir(session_id)),
            "fdr": fdr,
            "deltabeta": deltabeta,
        }
        return await call_r("volcano_plot", args, timeout=120)

    @mcp.tool()
    async def cluster_probes(
        session_id: str,
        n_probes: int = 1000,
        method: str = "hclust",
        distance: str = "euclidean",
    ) -> dict:
        """Generate a clustering heatmap of top variable probes.

        Selects the most variable probes, performs hierarchical clustering,
        and generates a heatmap with sample annotations.

        Returns base64-encoded PNG and cluster assignments.

        Args:
            session_id: Session ID from load_idats.
            n_probes: Number of top variable probes to include. Default 1000.
            method: Clustering method ('hclust'). Default 'hclust'.
            distance: Distance metric ('euclidean', 'manhattan', 'correlation'). Default 'euclidean'.
        """
        args = {
            "session_dir": str(session_dir(session_id)),
            "n_probes": n_probes,
            "method": method,
            "distance": distance,
        }
        return await call_r("cluster_probes", args, timeout=300)

    @mcp.tool()
    async def session_status(session_id: str) -> dict:
        """Check the status of an analysis session.

        Returns which pipeline steps have been completed, sample count,
        probe count, and creation time.

        Args:
            session_id: Session ID from load_idats.
        """
        d = session_dir(session_id)
        checkpoints = {f.stem: True for f in d.glob("*.rds")}
        csvs = [f.name for f in d.glob("*.csv")]
        plots = [f.name for f in d.glob("*.svg")] + [f.name for f in d.glob("*.png")]

        created = None
        ts_file = d / "created_at"
        if ts_file.exists():
            created = float(ts_file.read_text().strip())

        steps_completed = []
        if "raw" in checkpoints:
            steps_completed.append("load_idats")
        if "normalized" in checkpoints:
            steps_completed.append("normalize")
        if "filtered" in checkpoints:
            steps_completed.append("filter_probes")
        if "dmps" in checkpoints or "dmp_results" in checkpoints:
            steps_completed.append("run_limma")

        return {
            "session_id": session_id,
            "steps_completed": steps_completed,
            "checkpoints": list(checkpoints.keys()),
            "csv_files": csvs,
            "plots": plots,
            "created_at": created,
        }

    @mcp.tool()
    async def cleanup_session_tool(session_id: str) -> dict:
        """Remove an analysis session and all its data.

        Deletes the session directory including all checkpoints, results,
        and plots. This cannot be undone.

        Args:
            session_id: Session ID to remove.
        """
        success = cleanup_session(session_id)
        return {"success": success, "session_id": session_id}
