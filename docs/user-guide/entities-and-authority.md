# Entities and Authority

## What an Entity Is
An **Entity** is a semantic object tracked by the system—typically a Person, Company, Product, or Vendor. 

## Candidate Review Queue
When the AI reads an article, it highlights Proper Nouns it doesn't recognize and marks them as **Entity Candidates**. These are pooled in the Candidate Review Queue awaiting human triage.

## Approving, Rejecting, and Merging
In the Review Queue, you can:
* **Approve**: Turn it into a tracked Entity.
* **Reject**: Tell the system "don't track this word."
* **Merge**: Combine it with an existing entity (e.g., merging "MSFT" to "Microsoft").

## What Authority Means
Tracked entities generate **Authority**. If an entity is repeatedly mentioned in high-value, highly-relevant articles, its Authority Score rises.

## How Authority Influences Content
Incoming articles that mention High-Authority entities are artificially boosted in your content feed. Tracking authority allows the system to surface industry thought leaders dynamically.
