/**
 * Feature flags. Single source of truth for incrementally-enabled features.
 * Keep these as compile-time constants (not env vars) so dead code is
 * tree-shaken from the client bundle when a flag is off.
 */

/**
 * Surface Twitter/X affordances:
 *   - "X / Twitter" share button on ShareButtons
 *   - "Send as tweet" button on LetterGenerator
 *   - `twitter.site = "@iran_memorial"` association in metadata
 *
 * Off until the @iran_memorial handle is claimed across X / Bluesky /
 * Mastodon and an active posting cadence is in place. Pointing share
 * buttons at a non-existent account or claiming `twitter:site` for an
 * unowned handle would erode trust and risk handle-squatting.
 *
 * Flip to true once:
 *   1. The handle exists and is verified-ours
 *   2. At least one launch thread has been posted
 *   3. The press contact + reply pipeline is staffed
 */
export const ENABLE_TWITTER_INTEGRATION = false;
