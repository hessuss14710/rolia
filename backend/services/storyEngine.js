/**
 * Story Engine Client
 * Communicates with the Python Story Engine microservice for narrative management.
 */

const fetch = require('node-fetch');

const STORY_ENGINE_URL = process.env.STORY_ENGINE_URL || 'http://localhost:5001';

/**
 * Analyze a player's action for intent, karma, and triggers.
 */
async function analyzeAction({ roomId, userId, username, message, characterName, characterClass }) {
  try {
    const response = await fetch(`${STORY_ENGINE_URL}/analyze-action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        room_id: roomId,
        user_id: userId,
        username,
        message,
        character_name: characterName,
        character_class: characterClass
      })
    });

    if (!response.ok) {
      console.error('Story Engine analyze-action error:', response.status);
      return null;
    }

    return await response.json();
  } catch (err) {
    console.error('Story Engine connection error:', err.message);
    return null;
  }
}

/**
 * Get enriched AI context for narrative generation.
 */
async function getContext(roomId, options = {}) {
  try {
    const response = await fetch(`${STORY_ENGINE_URL}/get-context`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        room_id: roomId,
        include_npcs: options.includeNpcs !== false,
        include_hints: options.includeHints !== false,
        include_history_summary: options.includeHistorySummary || false
      })
    });

    if (!response.ok) {
      if (response.status === 404) {
        // No campaign progress - that's okay, return null
        return null;
      }
      console.error('Story Engine get-context error:', response.status);
      return null;
    }

    return await response.json();
  } catch (err) {
    console.error('Story Engine connection error:', err.message);
    return null;
  }
}

/**
 * Get simplified AI context formatted for system prompt.
 */
async function getAIContext(roomId) {
  try {
    const response = await fetch(`${STORY_ENGINE_URL}/ai-context/${roomId}`);

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      console.error('Story Engine ai-context error:', response.status);
      return null;
    }

    return await response.json();
  } catch (err) {
    console.error('Story Engine connection error:', err.message);
    return null;
  }
}

/**
 * Process a player decision.
 */
async function processDecision(roomId, decisionCode, chosenOption) {
  try {
    const response = await fetch(`${STORY_ENGINE_URL}/process-decision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        room_id: roomId,
        decision_code: decisionCode,
        chosen_option: chosenOption
      })
    });

    if (!response.ok) {
      console.error('Story Engine process-decision error:', response.status);
      return null;
    }

    return await response.json();
  } catch (err) {
    console.error('Story Engine connection error:', err.message);
    return null;
  }
}

/**
 * Calculate NPC reaction to player action.
 */
async function getNPCReaction(roomId, npcCode, actionType, actionDetails = {}) {
  try {
    const response = await fetch(`${STORY_ENGINE_URL}/npc-reaction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        room_id: roomId,
        npc_code: npcCode,
        action_type: actionType,
        action_details: actionDetails
      })
    });

    if (!response.ok) {
      console.error('Story Engine npc-reaction error:', response.status);
      return null;
    }

    return await response.json();
  } catch (err) {
    console.error('Story Engine connection error:', err.message);
    return null;
  }
}

/**
 * Get current story state for a room.
 */
async function getStoryState(roomId) {
  try {
    const response = await fetch(`${STORY_ENGINE_URL}/story-state/${roomId}`);

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      console.error('Story Engine story-state error:', response.status);
      return null;
    }

    return await response.json();
  } catch (err) {
    console.error('Story Engine connection error:', err.message);
    return null;
  }
}

/**
 * Initialize campaign progress for a room.
 */
async function initializeProgress(roomId, campaignId) {
  try {
    const response = await fetch(`${STORY_ENGINE_URL}/initialize-progress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        room_id: roomId,
        campaign_id: campaignId
      })
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('Story Engine initialize-progress error:', response.status, text);
      return null;
    }

    return await response.json();
  } catch (err) {
    console.error('Story Engine connection error:', err.message);
    return null;
  }
}

/**
 * Update story progress.
 */
async function updateProgress(roomId, updates) {
  try {
    const response = await fetch(`${STORY_ENGINE_URL}/update-progress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        room_id: roomId,
        ...updates
      })
    });

    if (!response.ok) {
      console.error('Story Engine update-progress error:', response.status);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Story Engine connection error:', err.message);
    return false;
  }
}

/**
 * Check for triggers (decisions, revelations, etc.)
 */
async function checkTrigger(roomId, triggerType, triggerData = {}) {
  try {
    const response = await fetch(`${STORY_ENGINE_URL}/check-trigger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        room_id: roomId,
        trigger_type: triggerType,
        trigger_data: triggerData
      })
    });

    if (!response.ok) {
      console.error('Story Engine check-trigger error:', response.status);
      return { triggered: false };
    }

    return await response.json();
  } catch (err) {
    console.error('Story Engine connection error:', err.message);
    return { triggered: false };
  }
}

/**
 * Get pending decision for a room.
 */
async function getPendingDecision(roomId) {
  try {
    const response = await fetch(`${STORY_ENGINE_URL}/pending-decision/${roomId}`);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.pending_decision;
  } catch (err) {
    console.error('Story Engine connection error:', err.message);
    return null;
  }
}

/**
 * Calculate ending probabilities.
 */
async function calculateEnding(roomId) {
  try {
    const response = await fetch(`${STORY_ENGINE_URL}/calculate-ending/${roomId}`);

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch (err) {
    console.error('Story Engine connection error:', err.message);
    return null;
  }
}

/**
 * List available campaigns.
 */
async function listCampaigns(themeId = null) {
  try {
    const url = themeId
      ? `${STORY_ENGINE_URL}/campaigns?theme_id=${themeId}`
      : `${STORY_ENGINE_URL}/campaigns`;

    const response = await fetch(url);

    if (!response.ok) {
      console.error('Story Engine campaigns error:', response.status);
      return [];
    }

    const data = await response.json();
    return data.campaigns || [];
  } catch (err) {
    console.error('Story Engine connection error:', err.message);
    return [];
  }
}

/**
 * Get campaign details.
 */
async function getCampaign(campaignId) {
  try {
    const response = await fetch(`${STORY_ENGINE_URL}/campaigns/${campaignId}`);

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      console.error('Story Engine campaign error:', response.status);
      return null;
    }

    return await response.json();
  } catch (err) {
    console.error('Story Engine connection error:', err.message);
    return null;
  }
}

/**
 * Process AI response markers and update state.
 */
async function processAIResponse(roomId, aiResponse, markers = {}) {
  try {
    const response = await fetch(`${STORY_ENGINE_URL}/process-response`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        room_id: roomId,
        ai_response: aiResponse,
        markers
      })
    });

    if (!response.ok) {
      console.error('Story Engine process-response error:', response.status);
      return false;
    }

    return await response.json();
  } catch (err) {
    console.error('Story Engine connection error:', err.message);
    return false;
  }
}

/**
 * Check if Story Engine is healthy.
 */
async function healthCheck() {
  try {
    const response = await fetch(`${STORY_ENGINE_URL}/health`);
    if (!response.ok) return false;
    const data = await response.json();
    return data.status === 'healthy';
  } catch (err) {
    return false;
  }
}

module.exports = {
  analyzeAction,
  getContext,
  getAIContext,
  processDecision,
  getNPCReaction,
  getStoryState,
  initializeProgress,
  updateProgress,
  checkTrigger,
  getPendingDecision,
  calculateEnding,
  listCampaigns,
  getCampaign,
  processAIResponse,
  healthCheck
};
