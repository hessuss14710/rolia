-- Migration: 002_story_system.sql
-- Description: Epic Stories System for RolIA
-- Creates tables for campaigns, acts, chapters, scenes, decisions, NPCs, and progression

-- ============================================
-- CAMPAIGNS - Main story containers
-- ============================================
CREATE TABLE IF NOT EXISTS campaigns (
    id SERIAL PRIMARY KEY,
    theme_id INTEGER REFERENCES themes(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL, -- URL-friendly identifier
    synopsis TEXT,
    tone VARCHAR(50) DEFAULT 'heroic', -- 'dark', 'heroic', 'mystery', 'horror', 'comedy'
    difficulty VARCHAR(20) DEFAULT 'standard', -- 'casual', 'standard', 'hardcore'
    estimated_sessions INTEGER DEFAULT 10,
    total_acts INTEGER DEFAULT 4,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- STORY ACTS - Major story divisions
-- ============================================
CREATE TABLE IF NOT EXISTS story_acts (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    act_number INTEGER NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    objectives TEXT[], -- Array of act objectives
    unlock_conditions JSONB DEFAULT '{}', -- Conditions to unlock this act
    estimated_sessions INTEGER DEFAULT 3,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(campaign_id, act_number)
);

-- Index for fast act lookups
CREATE INDEX IF NOT EXISTS idx_story_acts_campaign ON story_acts(campaign_id, act_number);

-- ============================================
-- STORY CHAPTERS - Subdivisions within acts
-- ============================================
CREATE TABLE IF NOT EXISTS story_chapters (
    id SERIAL PRIMARY KEY,
    act_id INTEGER NOT NULL REFERENCES story_acts(id) ON DELETE CASCADE,
    chapter_number INTEGER NOT NULL,
    title VARCHAR(255) NOT NULL,
    narrative_hook TEXT, -- Initial narrative hook
    key_npcs JSONB DEFAULT '[]', -- Important NPCs in this chapter
    locations JSONB DEFAULT '[]', -- Key locations
    possible_branches JSONB DEFAULT '[]', -- Possible story branches
    is_optional BOOLEAN DEFAULT FALSE, -- Side chapter
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(act_id, chapter_number)
);

-- Index for fast chapter lookups
CREATE INDEX IF NOT EXISTS idx_story_chapters_act ON story_chapters(act_id, chapter_number);

-- ============================================
-- STORY SCENES - Minimal playable units
-- ============================================
CREATE TABLE IF NOT EXISTS story_scenes (
    id SERIAL PRIMARY KEY,
    chapter_id INTEGER NOT NULL REFERENCES story_chapters(id) ON DELETE CASCADE,
    scene_order INTEGER NOT NULL,
    scene_type VARCHAR(50) NOT NULL, -- 'narrative', 'combat', 'puzzle', 'social', 'revelation', 'decision'
    title VARCHAR(255) NOT NULL,
    opening_narration TEXT, -- Opening narration text
    ai_context TEXT, -- Context for AI narration
    ai_secret_instructions TEXT, -- Hidden instructions for AI (foreshadowing, twists)
    victory_conditions JSONB DEFAULT '{}',
    failure_conditions JSONB DEFAULT '{}',
    rewards JSONB DEFAULT '{}',
    next_scene_default INTEGER, -- Default next scene ID
    branch_triggers JSONB DEFAULT '[]', -- Triggers that activate alternative branches
    tension_level VARCHAR(20) DEFAULT 'normal', -- 'low', 'normal', 'high', 'critical'
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(chapter_id, scene_order)
);

-- Index for fast scene lookups
CREATE INDEX IF NOT EXISTS idx_story_scenes_chapter ON story_scenes(chapter_id, scene_order);

-- ============================================
-- STORY DECISIONS - Critical choices
-- ============================================
CREATE TABLE IF NOT EXISTS story_decisions (
    id SERIAL PRIMARY KEY,
    scene_id INTEGER NOT NULL REFERENCES story_scenes(id) ON DELETE CASCADE,
    decision_code VARCHAR(50) UNIQUE NOT NULL, -- Unique identifier for the decision
    title VARCHAR(255) NOT NULL,
    description TEXT,
    options JSONB NOT NULL, -- Array of options with labels and consequences
    -- Example: [{"id": "trust", "label": "Confiar en Lord Varen", "karma": 0, "consequence_flags": ["trusted_varen"]}]
    consequences JSONB DEFAULT '{}', -- Detailed consequences mapping
    affects_ending BOOLEAN DEFAULT FALSE,
    is_hidden BOOLEAN DEFAULT FALSE, -- Hidden decisions (based on behavior, not explicit choice)
    timeout_turns INTEGER, -- Turns before auto-decision
    default_option VARCHAR(50), -- Default if timeout
    created_at TIMESTAMP DEFAULT NOW()
);

-- Index for decision lookups
CREATE INDEX IF NOT EXISTS idx_story_decisions_scene ON story_decisions(scene_id);
CREATE INDEX IF NOT EXISTS idx_story_decisions_code ON story_decisions(decision_code);

-- ============================================
-- SIDE STORIES - Optional mini-quests
-- ============================================
CREATE TABLE IF NOT EXISTS side_stories (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    trigger_chapter_id INTEGER REFERENCES story_chapters(id) ON DELETE SET NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    narrative TEXT, -- Full narrative content
    trigger_conditions JSONB DEFAULT '{}', -- Conditions to trigger this side story
    rewards JSONB DEFAULT '{}',
    connects_to_main BOOLEAN DEFAULT FALSE, -- Affects main story
    revelation_for_main TEXT, -- What it reveals about main plot
    estimated_duration VARCHAR(50) DEFAULT '1 session',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Index for side story lookups
CREATE INDEX IF NOT EXISTS idx_side_stories_campaign ON side_stories(campaign_id);
CREATE INDEX IF NOT EXISTS idx_side_stories_trigger ON side_stories(trigger_chapter_id);

-- ============================================
-- STORY NPCS - Characters with personality
-- ============================================
CREATE TABLE IF NOT EXISTS story_npcs (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL, -- Internal code (e.g., 'varen', 'lyra')
    name VARCHAR(255) NOT NULL,
    apparent_role VARCHAR(100), -- 'ally', 'enemy', 'neutral', 'mentor'
    true_role VARCHAR(100), -- Real role (for betrayals/reveals)
    description TEXT,
    appearance TEXT,
    personality JSONB DEFAULT '{}', -- Personality traits with values
    -- Example: {"cunning": 90, "loyalty": 10, "patience": 85}
    secrets TEXT[], -- Secrets this NPC knows
    dialogue_style TEXT, -- How they speak
    relationship_default INTEGER DEFAULT 50, -- 0-100 starting relationship
    betrayal_threshold INTEGER, -- Relationship below which they betray
    redemption_threshold INTEGER, -- Relationship above which they can be redeemed
    first_appearance_scene_id INTEGER REFERENCES story_scenes(id) ON DELETE SET NULL,
    is_major BOOLEAN DEFAULT FALSE, -- Major character
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(campaign_id, code)
);

-- Index for NPC lookups
CREATE INDEX IF NOT EXISTS idx_story_npcs_campaign ON story_npcs(campaign_id);
CREATE INDEX IF NOT EXISTS idx_story_npcs_code ON story_npcs(campaign_id, code);

-- ============================================
-- STORY CLUES - Plot revelations
-- ============================================
CREATE TABLE IF NOT EXISTS story_clues (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL, -- Unique clue identifier
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL, -- What the clue reveals
    related_twist VARCHAR(100), -- Which twist this clue relates to
    foreshadow_hint TEXT, -- Subtle hint for AI to include before reveal
    discovery_scene_id INTEGER REFERENCES story_scenes(id) ON DELETE SET NULL,
    is_required BOOLEAN DEFAULT FALSE, -- Required for main plot
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(campaign_id, code)
);

-- Index for clue lookups
CREATE INDEX IF NOT EXISTS idx_story_clues_campaign ON story_clues(campaign_id);

-- ============================================
-- STORY ENDINGS - Multiple endings
-- ============================================
CREATE TABLE IF NOT EXISTS story_endings (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL, -- 'ending_a', 'ending_b', etc.
    title VARCHAR(255) NOT NULL,
    description TEXT,
    narration TEXT, -- Ending narration
    requirements JSONB NOT NULL, -- Flags/decisions required
    -- Example: {"flags": ["exposed_varen"], "karma_min": 50, "decisions": {"trust_varen": "investigate"}}
    is_good_ending BOOLEAN DEFAULT TRUE,
    epilogue TEXT, -- What happens after
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(campaign_id, code)
);

-- Index for ending lookups
CREATE INDEX IF NOT EXISTS idx_story_endings_campaign ON story_endings(campaign_id);

-- ============================================
-- ROOM CAMPAIGN PROGRESS - Tracking progress
-- ============================================
CREATE TABLE IF NOT EXISTS room_campaign_progress (
    id SERIAL PRIMARY KEY,
    room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    current_act INTEGER DEFAULT 1,
    current_chapter INTEGER DEFAULT 1,
    current_scene INTEGER DEFAULT 1,
    decisions_made JSONB DEFAULT '{}', -- Map of decision_code -> chosen_option
    side_stories_completed TEXT[] DEFAULT '{}', -- Array of completed side story codes
    story_flags JSONB DEFAULT '{}', -- Arbitrary story flags
    revealed_clues TEXT[] DEFAULT '{}', -- Array of revealed clue codes
    karma INTEGER DEFAULT 50, -- 0-100 karma scale
    faction_standings JSONB DEFAULT '{}', -- Faction relationship scores
    ending_path VARCHAR(50), -- Current most likely ending
    ending_probabilities JSONB DEFAULT '{}', -- Probabilities for each ending
    pending_decision_code VARCHAR(50), -- Currently pending decision
    pending_decision_turns INTEGER, -- Turns remaining for decision
    started_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    UNIQUE(room_id, campaign_id)
);

-- Index for progress lookups
CREATE INDEX IF NOT EXISTS idx_room_campaign_progress_room ON room_campaign_progress(room_id);
CREATE INDEX IF NOT EXISTS idx_room_campaign_progress_campaign ON room_campaign_progress(campaign_id);

-- ============================================
-- ROOM NPC RELATIONSHIPS - Per-room NPC state
-- ============================================
CREATE TABLE IF NOT EXISTS room_npc_relationships (
    id SERIAL PRIMARY KEY,
    room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    npc_id INTEGER NOT NULL REFERENCES story_npcs(id) ON DELETE CASCADE,
    relationship_score INTEGER DEFAULT 50, -- 0-100
    trust_level INTEGER DEFAULT 50, -- 0-100
    known_secrets TEXT[] DEFAULT '{}', -- Secrets revealed to players
    interactions_count INTEGER DEFAULT 0,
    last_interaction TIMESTAMP,
    emotional_state VARCHAR(50) DEFAULT 'neutral', -- Current mood
    betrayal_triggered BOOLEAN DEFAULT FALSE,
    redemption_triggered BOOLEAN DEFAULT FALSE,
    custom_state JSONB DEFAULT '{}', -- Custom state data
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(room_id, npc_id)
);

-- Index for relationship lookups
CREATE INDEX IF NOT EXISTS idx_room_npc_relationships_room ON room_npc_relationships(room_id);
CREATE INDEX IF NOT EXISTS idx_room_npc_relationships_npc ON room_npc_relationships(npc_id);

-- ============================================
-- STORY EVENTS LOG - Event sourcing
-- ============================================
CREATE TABLE IF NOT EXISTS story_events (
    id SERIAL PRIMARY KEY,
    room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL, -- 'scene_start', 'decision_made', 'clue_found', 'npc_interaction', 'karma_change'
    event_data JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Index for event lookups
CREATE INDEX IF NOT EXISTS idx_story_events_room ON story_events(room_id);
CREATE INDEX IF NOT EXISTS idx_story_events_type ON story_events(event_type);
CREATE INDEX IF NOT EXISTS idx_story_events_created ON story_events(created_at DESC);

-- ============================================
-- VIEWS FOR COMMON QUERIES
-- ============================================

-- View: Full story structure for a campaign
CREATE OR REPLACE VIEW v_campaign_structure AS
SELECT
    c.id AS campaign_id,
    c.name AS campaign_name,
    c.code AS campaign_code,
    c.tone,
    c.difficulty,
    a.id AS act_id,
    a.act_number,
    a.title AS act_title,
    ch.id AS chapter_id,
    ch.chapter_number,
    ch.title AS chapter_title,
    ch.is_optional,
    s.id AS scene_id,
    s.scene_order,
    s.scene_type,
    s.title AS scene_title,
    s.tension_level
FROM campaigns c
LEFT JOIN story_acts a ON a.campaign_id = c.id
LEFT JOIN story_chapters ch ON ch.act_id = a.id
LEFT JOIN story_scenes s ON s.chapter_id = ch.id
ORDER BY c.id, a.act_number, ch.chapter_number, s.scene_order;

-- View: Room story progress with campaign details
CREATE OR REPLACE VIEW v_room_story_progress AS
SELECT
    rcp.id AS progress_id,
    r.id AS room_id,
    r.code AS room_code,
    r.name AS room_name,
    c.id AS campaign_id,
    c.name AS campaign_name,
    c.code AS campaign_code,
    rcp.current_act,
    rcp.current_chapter,
    rcp.current_scene,
    rcp.karma,
    rcp.ending_path,
    rcp.story_flags,
    rcp.decisions_made,
    rcp.started_at,
    rcp.updated_at,
    rcp.completed_at
FROM room_campaign_progress rcp
JOIN rooms r ON r.id = rcp.room_id
JOIN campaigns c ON c.id = rcp.campaign_id;

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function: Update room progress timestamp
CREATE OR REPLACE FUNCTION update_room_progress_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Auto-update progress timestamp
DROP TRIGGER IF EXISTS trigger_update_room_progress_timestamp ON room_campaign_progress;
CREATE TRIGGER trigger_update_room_progress_timestamp
    BEFORE UPDATE ON room_campaign_progress
    FOR EACH ROW
    EXECUTE FUNCTION update_room_progress_timestamp();

-- Function: Log story event
CREATE OR REPLACE FUNCTION log_story_event(
    p_room_id INTEGER,
    p_event_type VARCHAR(50),
    p_event_data JSONB
)
RETURNS INTEGER AS $$
DECLARE
    v_event_id INTEGER;
BEGIN
    INSERT INTO story_events (room_id, event_type, event_data)
    VALUES (p_room_id, p_event_type, p_event_data)
    RETURNING id INTO v_event_id;

    RETURN v_event_id;
END;
$$ LANGUAGE plpgsql;

-- Function: Get current scene details for a room
CREATE OR REPLACE FUNCTION get_current_scene(p_room_id INTEGER)
RETURNS TABLE (
    scene_id INTEGER,
    scene_title VARCHAR(255),
    scene_type VARCHAR(50),
    opening_narration TEXT,
    ai_context TEXT,
    ai_secret_instructions TEXT,
    tension_level VARCHAR(20),
    chapter_title VARCHAR(255),
    act_title VARCHAR(255),
    campaign_name VARCHAR(255)
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        s.id,
        s.title,
        s.scene_type,
        s.opening_narration,
        s.ai_context,
        s.ai_secret_instructions,
        s.tension_level,
        ch.title,
        a.title,
        c.name
    FROM room_campaign_progress rcp
    JOIN campaigns c ON c.id = rcp.campaign_id
    JOIN story_acts a ON a.campaign_id = c.id AND a.act_number = rcp.current_act
    JOIN story_chapters ch ON ch.act_id = a.id AND ch.chapter_number = rcp.current_chapter
    JOIN story_scenes s ON s.chapter_id = ch.id AND s.scene_order = rcp.current_scene
    WHERE rcp.room_id = p_room_id
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function: Calculate ending probabilities
CREATE OR REPLACE FUNCTION calculate_ending_probabilities(p_room_id INTEGER)
RETURNS JSONB AS $$
DECLARE
    v_progress room_campaign_progress%ROWTYPE;
    v_endings JSONB := '{}';
    v_ending RECORD;
    v_score INTEGER;
    v_total_score INTEGER := 0;
    v_flags JSONB;
    v_decisions JSONB;
BEGIN
    -- Get current progress
    SELECT * INTO v_progress
    FROM room_campaign_progress
    WHERE room_id = p_room_id;

    IF NOT FOUND THEN
        RETURN '{}'::JSONB;
    END IF;

    v_flags := v_progress.story_flags;
    v_decisions := v_progress.decisions_made;

    -- Calculate score for each ending
    FOR v_ending IN
        SELECT code, requirements
        FROM story_endings
        WHERE campaign_id = v_progress.campaign_id
    LOOP
        v_score := 50; -- Base score

        -- Add points for matching flags
        IF v_ending.requirements ? 'flags' THEN
            SELECT COUNT(*) INTO v_score
            FROM jsonb_array_elements_text(v_ending.requirements->'flags') AS flag
            WHERE v_flags ? flag;
            v_score := v_score * 20;
        END IF;

        -- Add points for karma range
        IF v_ending.requirements ? 'karma_min' THEN
            IF v_progress.karma >= (v_ending.requirements->>'karma_min')::INTEGER THEN
                v_score := v_score + 30;
            END IF;
        END IF;

        v_endings := v_endings || jsonb_build_object(v_ending.code, v_score);
        v_total_score := v_total_score + v_score;
    END LOOP;

    -- Normalize to probabilities
    IF v_total_score > 0 THEN
        SELECT jsonb_object_agg(key, (value::INTEGER * 100 / v_total_score))
        INTO v_endings
        FROM jsonb_each_text(v_endings);
    END IF;

    RETURN v_endings;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- SEED: Add campaign_id to rooms table if not exists
-- ============================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'rooms' AND column_name = 'campaign_id'
    ) THEN
        ALTER TABLE rooms ADD COLUMN campaign_id INTEGER REFERENCES campaigns(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Index for campaign lookups on rooms
CREATE INDEX IF NOT EXISTS idx_rooms_campaign ON rooms(campaign_id);

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE campaigns IS 'Main story campaigns/adventures';
COMMENT ON TABLE story_acts IS 'Major story divisions within a campaign';
COMMENT ON TABLE story_chapters IS 'Chapters within acts, can be optional (side content)';
COMMENT ON TABLE story_scenes IS 'Minimal playable units with AI context';
COMMENT ON TABLE story_decisions IS 'Critical choice points that affect the story';
COMMENT ON TABLE side_stories IS 'Optional mini-quests that may reveal main plot info';
COMMENT ON TABLE story_npcs IS 'NPCs with personalities and secret agendas';
COMMENT ON TABLE story_clues IS 'Plot revelations and foreshadowing elements';
COMMENT ON TABLE story_endings IS 'Multiple possible endings based on player choices';
COMMENT ON TABLE room_campaign_progress IS 'Tracks each room progress through a campaign';
COMMENT ON TABLE room_npc_relationships IS 'Per-room NPC relationship states';
COMMENT ON TABLE story_events IS 'Event sourcing log for story progression';
