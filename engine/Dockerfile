FROM rocker/r-ver:4.5.0

LABEL maintainer="Polymer Genomics"
LABEL description="Polymer Methylation Toolkit — R + MCP server for methylation analysis"

# System dependencies for R packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    libcurl4-openssl-dev \
    libssl-dev \
    libxml2-dev \
    libpng-dev \
    zlib1g-dev \
    python3 \
    python3-pip \
    python3-venv \
    && rm -rf /var/lib/apt/lists/*

# Bioconductor packages
RUN Rscript -e "install.packages('BiocManager', repos='https://cran.r-project.org'); \
    BiocManager::install(c('minfi', 'sesame', 'limma', 'matrixStats', \
    'maxprobes', 'ComplexHeatmap', 'circlize'), ask=FALSE, update=FALSE)"

# CRAN packages
RUN Rscript -e "install.packages(c('jsonlite', 'ggplot2', 'svglite', 'base64enc'), \
    repos='https://cran.r-project.org')"

# Python MCP server
RUN python3 -m venv /opt/polymer/venv
ENV PATH="/opt/polymer/venv/bin:$PATH"
RUN pip install --no-cache-dir polymer-genomics-mcp

# Bundle R scripts
COPY r_scripts/ /opt/polymer/r_scripts/
ENV POLYMER_R_SCRIPTS=/opt/polymer/r_scripts
ENV POLYMER_SESSIONS_DIR=/tmp/polymer/sessions

# Create sessions directory
RUN mkdir -p /tmp/polymer/sessions

ENTRYPOINT ["python3", "-m", "polymer_genomics_mcp"]
