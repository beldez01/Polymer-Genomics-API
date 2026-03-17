"""Prebuilt cross-layer query recipes.

Named presets that demonstrate the power of intersect_layers. These are
curated queries that answer common biological questions using multi-layer
intersection.
"""

from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/v1/query", tags=["recipes"])


# ── Recipe definitions ───────────────────────────────────────────

RECIPES = {
    "silencing_prone_regions": {
        "name": "Silencing-Prone Regions",
        "description": (
            "Find CpG islands in regions with high conservation and active "
            "chromatin marks — candidates for epigenetic silencing if methylated."
        ),
        "filters": [
            {"layer": "cpg_islands", "op": "overlaps"},
            {"layer": "conservation", "field": "phylop_mean", "op": ">", "value": 2.0},
        ],
        "return_layers": ["cpg_islands", "conservation"],
        "use_case": "Evaluate silencing risk for synthetic constructs in mammalian cells",
    },
    "biophysically_unusual_cpg_islands": {
        "name": "Biophysically Unusual CpG Islands",
        "description": (
            "CpG islands with extreme thermodynamic stability — these may resist "
            "strand separation and affect replication or transcription initiation."
        ),
        "filters": [
            {"layer": "cpg_islands", "op": "overlaps"},
            {"layer": "biophysics", "field": "stacking_dg37", "op": "<", "value": -1.7},
        ],
        "return_layers": ["cpg_islands", "biophysics"],
        "use_case": "Identify CpG islands with unusual physical properties",
    },
    "regulatory_hotspots": {
        "name": "Regulatory Hotspots",
        "description": (
            "Regions with overlapping cCREs (candidate cis-regulatory elements) "
            "and GWAS hits — functionally validated regulatory regions."
        ),
        "filters": [
            {"layer": "ccre", "op": "overlaps"},
            {"layer": "breakpoints", "op": "overlaps"},
        ],
        "return_layers": ["ccre", "breakpoints"],
        "use_case": "Find fragile regulatory regions",
    },
    "conserved_nonb_dna": {
        "name": "Conserved Non-B DNA",
        "description": (
            "Non-B DNA structures (G-quadruplex, Z-DNA, cruciform) in highly "
            "conserved regions — likely functional structural elements."
        ),
        "filters": [
            {"layer": "nonb_dna", "op": "overlaps"},
            {"layer": "conservation", "field": "phylop_mean", "op": ">", "value": 3.0},
        ],
        "return_layers": ["nonb_dna", "conservation"],
        "use_case": "Identify conserved DNA structural elements",
    },
    "repeat_fragility_zones": {
        "name": "Repeat Fragility Zones",
        "description": (
            "Overlapping repeat elements and chromosomal breakpoints — regions "
            "prone to structural rearrangement."
        ),
        "filters": [
            {"layer": "repeats", "op": "overlaps"},
            {"layer": "breakpoints", "op": "overlaps"},
        ],
        "return_layers": ["repeats", "breakpoints"],
        "use_case": "Map fragile regions driven by repetitive elements",
    },
}


@router.get("/recipes")
async def list_recipes():
    """List all available cross-layer query recipes.

    Recipes are prebuilt intersect_layers queries that answer common
    biological questions. Use /v1/query/recipe/{name} to get the full
    recipe with filters ready to submit to /v1/query/intersect.
    """
    return {
        "recipes": [
            {
                "key": key,
                "name": r["name"],
                "description": r["description"],
                "use_case": r["use_case"],
                "n_filters": len(r["filters"]),
            }
            for key, r in RECIPES.items()
        ],
    }


@router.get("/recipe/{recipe_key}")
async def get_recipe(recipe_key: str):
    """Get a specific recipe with its full filter specification.

    The returned filters can be submitted directly to POST /v1/query/intersect
    with a region of your choice.

    Example workflow:
    1. GET /v1/query/recipes → browse available recipes
    2. GET /v1/query/recipe/silencing_prone_regions → get filters
    3. POST /v1/query/intersect with {region: "chr17:7668402-7687550", filters: <from step 2>}
    """
    recipe = RECIPES.get(recipe_key)
    if recipe is None:
        raise HTTPException(
            404,
            {
                "error": {
                    "code": "RECIPE_NOT_FOUND",
                    "message": f"Unknown recipe: '{recipe_key}'. Use GET /v1/query/recipes to list available recipes.",
                    "available": sorted(RECIPES.keys()),
                }
            },
        )

    return {
        "key": recipe_key,
        "name": recipe["name"],
        "description": recipe["description"],
        "use_case": recipe["use_case"],
        "filters": recipe["filters"],
        "return_layers": recipe["return_layers"],
        "usage": {
            "endpoint": "POST /v1/query/intersect",
            "body_template": {
                "build": "hg38",
                "region": "<your region here, e.g. chr17:7668402-7687550>",
                "filters": recipe["filters"],
                "return_layers": recipe["return_layers"],
            },
        },
    }
