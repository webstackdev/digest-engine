import type { StaticImageData } from "next/image";

import authorityAwareRankingHeroImage from "@/content/blog/authority-aware-ranking/hero.svg";
import authorityAwareRankingPreviewImage from "@/content/blog/authority-aware-ranking/preview.svg";
import competitiveIntelligenceBuiltInHeroImage from "@/content/blog/competitive-intelligence-built-in/hero.svg";
import competitiveIntelligenceBuiltInPreviewImage from "@/content/blog/competitive-intelligence-built-in/preview.svg";
import composableAiSkillsHeroImage from "@/content/blog/composable-ai-skills/hero.svg";
import composableAiSkillsPreviewImage from "@/content/blog/composable-ai-skills/preview.svg";
import draftAssemblyNotJustCurationHeroImage from "@/content/blog/draft-assembly-not-just-curation/hero.svg";
import draftAssemblyNotJustCurationPreviewImage from "@/content/blog/draft-assembly-not-just-curation/preview.svg";
import humanReviewByDefaultHeroImage from "@/content/blog/human-review-by-default/hero.svg";
import humanReviewByDefaultPreviewImage from "@/content/blog/human-review-by-default/preview.svg";
import perProjectRelevanceTrainingHeroImage from "@/content/blog/per-project-relevance-training/hero.svg";
import perProjectRelevanceTrainingPreviewImage from "@/content/blog/per-project-relevance-training/preview.svg";
import selfHostableBringYourOwnModelsHeroImage from "@/content/blog/self-hostable-bring-your-own-models/hero.svg";
import selfHostableBringYourOwnModelsPreviewImage from "@/content/blog/self-hostable-bring-your-own-models/preview.svg";
import trendVelocityNotTrendVolumeHeroImage from "@/content/blog/trend-velocity-not-trend-volume/hero.svg";
import trendVelocityNotTrendVolumePreviewImage from "@/content/blog/trend-velocity-not-trend-volume/preview.svg";
import unifiedEntityProfilesHeroImage from "@/content/blog/unified-entity-profiles/hero.svg";
import unifiedEntityProfilesPreviewImage from "@/content/blog/unified-entity-profiles/preview.svg";

export const blogHeroImages: Record<string, StaticImageData> = {
  "authority-aware-ranking": authorityAwareRankingHeroImage,
  "competitive-intelligence-built-in": competitiveIntelligenceBuiltInHeroImage,
  "composable-ai-skills": composableAiSkillsHeroImage,
  "draft-assembly-not-just-curation": draftAssemblyNotJustCurationHeroImage,
  "human-review-by-default": humanReviewByDefaultHeroImage,
  "per-project-relevance-training": perProjectRelevanceTrainingHeroImage,
  "self-hostable-bring-your-own-models": selfHostableBringYourOwnModelsHeroImage,
  "trend-velocity-not-trend-volume": trendVelocityNotTrendVolumeHeroImage,
  "unified-entity-profiles": unifiedEntityProfilesHeroImage,
};

export const blogPreviewImages: Record<string, StaticImageData> = {
  "authority-aware-ranking": authorityAwareRankingPreviewImage,
  "competitive-intelligence-built-in": competitiveIntelligenceBuiltInPreviewImage,
  "composable-ai-skills": composableAiSkillsPreviewImage,
  "draft-assembly-not-just-curation": draftAssemblyNotJustCurationPreviewImage,
  "human-review-by-default": humanReviewByDefaultPreviewImage,
  "per-project-relevance-training": perProjectRelevanceTrainingPreviewImage,
  "self-hostable-bring-your-own-models": selfHostableBringYourOwnModelsPreviewImage,
  "trend-velocity-not-trend-volume": trendVelocityNotTrendVolumePreviewImage,
  "unified-entity-profiles": unifiedEntityProfilesPreviewImage,
};
