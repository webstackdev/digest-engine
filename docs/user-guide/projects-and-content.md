# Projects and Content

## What a Project Is
In this platform, a **Project** equates to a specific newsletter brand or topic. Everything—Settings, Articles, Team Members, and specifically the AI's "understanding" of your taste—lives strictly inside boundaries of a single Project. 

## Content List & Filters
The Content Dashboard displays every article discovered from your plugins. 
* Use the **Category** dropdown to filter items down to just *Tutorials* or just *News*.
* Use the **Relevance** slider to hide junk items.

## Relevance Scores
The system assigns a score to everything it ingests, representing "How likely is this article a good fit for this project?"
* **Low score (0.0 - 0.4)**: Probably off-topic.
* **High score (0.8+)**: Perfect fit.
* **Mid score**: Ambiguous. The AI read it and made a guess.

Read more about the math in [Algorithms](../reference/algorithms.md).

## Opening a Content Item
Clicking an item reveals the original abstract, AI-generated summary, source metadata, and extracted entities (people/companies mentioned inside it).

## Marking Content as Relevant/Not-Relevant
Under each item, you will see a Thumbs Up / Thumbs Down mechanism. This is explicit feedback. Click Thumbs Up *only* on articles that perfectly exemplify your Newsletter.

## How Feedback Affects Future Ranking
When you thumbs-up an article, its underlying data mathematically shifts the Project's "Topic Centroid." This means future incoming articles matching that vibe will score *higher*. See [Feedback and Tuning](feedback-and-tuning.md).
