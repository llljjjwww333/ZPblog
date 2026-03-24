---
title: 'ZPblog: A Multi-Agent Framework for Intelligent Content Curation and Recommendation'
tags:
  - Python
  - FastAPI
  - React
  - Multi-agent Systems
  - LLM
  - Recommendation Algorithms
authors:
  - name: Junwen Lou
    orcid: 0009-0003-5269-0365 
    affiliation: 1
affiliations:
  - name: School of Software, Henan Polytechnic University, China
    index: 1
date: 24 March 2026
bibliography: paper.bib
---

## Overview

`ZPblog` is a full-stack content ecosystem designed to bridge the gap between traditional Content Management Systems (CMS) and modern Agentic workflows. Unlike conventional blogging platforms that serve as passive data repositories, `ZPblog` implements an active backend capable of autonomous content auditing and semantic-aware distribution. The system is engineered with a high-performance **FastAPI** asynchronous core and a **React 18** frontend, comprising over 25,000 lines of original code to handle complex state management and real-time AI interactions.

## Statement of Need

In the era of Generative AI, traditional platforms (e.g., WordPress) struggle with two technical bottlenecks:
1. **The Moderation Gap**: The surge in AI-generated content makes manual editorial review unscalable. Basic keyword filtering cannot evaluate the nuanced quality, stylistic consistency, or factual grounding required for high-standard publishing.
2. **The Discovery Cold-Start**: Popularity-based recommendation engines often trap new creators in a "zero-traffic" loop. Without historical engagement data, high-quality niche content remains invisible to potential readers.

`ZPblog` addresses these challenges by shifting the platform's role from a storage container to an active intelligent curator.

## Core Implementations

### Multi-Agent Collaborative Workflow
Instead of a single-stage LLM prompt, `ZPblog` orchestrates a committee of specialized agents to simulate a professional editorial department. We implemented five distinct roles—including **Content Critic, Grammar Checker, and Style Evaluator**—that process submissions through an asynchronous pipeline. This collaborative approach ensures that every post receives multi-dimensional feedback, allowing creators to refine their work based on specific structural and stylistic critiques.

### Hybrid Recommendation Engine
To democratize content discovery, we designed a hybrid engine that fuses **User-based Collaborative Filtering** with **Deep Content-based Feature Extraction**. By computing semantic embeddings of articles, `ZPblog` can match new posts with relevant readers based on topic resonance rather than just click counts, effectively mitigating the cold-start problem for emerging authors.

## Architecture and Reliability

The system is built with a focus on modularity and type safety:
- **Backend Infrastructure**: Powered by **SQLAlchemy 2.0** with **Alembic** for schema migrations, managing complex relational data including nested social graphs and multi-level comment threads.
- **Frontend State**: The **TypeScript**-based React frontend ensures strict interface definitions, which is critical for handling streaming LLM responses and real-time WebSocket notifications.
- **Quality Assurance**: `ZPblog` includes an automated test suite of **16 specialized test cases** executed via `pytest`. These tests validate the critical path from JWT-authenticated session management to the internal dispatching logic of the Multi-agent service, ensuring 100% reliability in the production build.

## Research Significance

`ZPblog` provides a production-grade reference for researchers exploring the integration of LLMs within social software. By decoupling the AI service layer—supporting providers like **OpenAI, DeepSeek, and Qwen**—it enables seamless benchmarking of different model backends in a real-world application context, serving as a robust baseline for studies on human-AI collaborative writing.

## References