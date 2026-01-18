-- Seed: Las Sombras de Valdoria Campaign
-- Run after migrations/002_story_system.sql

-- Use existing fantasy theme
-- Insert Campaign
INSERT INTO campaigns (code, name, synopsis, tone, difficulty, estimated_sessions, total_acts, theme_id)
SELECT
    'sombras-valdoria',
    'Las Sombras de Valdoria',
    'En el reino de Valdoria, los jugadores son convocados como héroes para investigar la desaparición del Príncipe Aldric. Lo que comienza como una simple misión de rescate se convierte en una conspiración que involucra traición real, magia prohibida, y la revelación de que el verdadero enemigo ha estado a su lado todo el tiempo.',
    'mystery',
    'standard',
    12,
    4,
    t.id
FROM themes t WHERE t.name = 'fantasy'
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    synopsis = EXCLUDED.synopsis,
    updated_at = NOW();

-- Get campaign ID
DO $$
DECLARE
    v_campaign_id INTEGER;
    v_act1_id INTEGER;
    v_act2_id INTEGER;
    v_act3_id INTEGER;
    v_act4_id INTEGER;
    v_chapter_id INTEGER;
    v_scene_id INTEGER;
BEGIN
    SELECT id INTO v_campaign_id FROM campaigns WHERE code = 'sombras-valdoria';

    -- ===========================================
    -- ACT 1: El Llamado
    -- ===========================================
    INSERT INTO story_acts (campaign_id, act_number, title, description, objectives, estimated_sessions)
    VALUES (v_campaign_id, 1, 'El Llamado',
            'Los héroes llegan a la capital de Valdoria y comienzan su investigación sobre la desaparición del Príncipe Aldric.',
            ARRAY['Presentarse ante la Reina Isadora', 'Investigar los aposentos del príncipe', 'Descubrir las primeras pistas sobre su desaparición'],
            4)
    ON CONFLICT (campaign_id, act_number) DO UPDATE SET title = EXCLUDED.title
    RETURNING id INTO v_act1_id;

    -- Chapter 1.1: La Convocatoria
    INSERT INTO story_chapters (act_id, chapter_number, title, narrative_hook, key_npcs, locations)
    VALUES (v_act1_id, 1, 'La Convocatoria',
            'Rumores de la desaparición del Príncipe Aldric han llegado hasta los rincones más remotos del reino.',
            '["varen", "isadora"]'::jsonb,
            '["castillo_valdoria", "salon_trono"]'::jsonb)
    ON CONFLICT (act_id, chapter_number) DO UPDATE SET title = EXCLUDED.title
    RETURNING id INTO v_chapter_id;

    -- Scenes for Chapter 1.1
    INSERT INTO story_scenes (chapter_id, scene_order, scene_type, title, opening_narration, ai_context, ai_secret_instructions, tension_level)
    VALUES
    (v_chapter_id, 1, 'narrative', 'Llegada a la Capital',
     'Las torres del Castillo de Valdoria se alzan contra el cielo gris mientras vuestro grupo atraviesa las puertas de la ciudad capital.',
     'Los jugadores llegan a la capital. Describir el ambiente sombrío, los susurros de los ciudadanos.',
     'Introducir sutilmente que Lord Varen fue quien recomendó contratar aventureros.',
     'normal'),
    (v_chapter_id, 2, 'social', 'El Consejero Real',
     'Lord Varen os recibe en sus aposentos privados. Es un hombre de mediana edad, con ojos calculadores.',
     'Lord Varen es aparentemente servicial pero secretamente manipulador.',
     'Varen está probando a los jugadores para ver si puede manipularlos.',
     'normal'),
    (v_chapter_id, 3, 'social', 'Audiencia con la Reina',
     'La Reina Isadora os recibe en el salón del trono. Sus ojos, enrojecidos pero dignos, os estudian.',
     'La Reina está genuinamente preocupada. Lord Varen la observa con atención.',
     'La Reina evita mencionar ciertos detalles sobre la noche de la desaparición.',
     'normal'),
    (v_chapter_id, 4, 'investigation', 'Los Aposentos del Príncipe',
     'Las habitaciones del Príncipe Aldric permanecen intactas. Un olor a tinta vieja y pergamino llena el aire.',
     'Pistas a encontrar: un diario parcialmente quemado, una carta a "L", un medallón de la Llama Negra.',
     'El príncipe estaba investigando una conspiración.',
     'normal')
    ON CONFLICT (chapter_id, scene_order) DO UPDATE SET title = EXCLUDED.title;

    -- Chapter 1.2: Primeras Pistas
    INSERT INTO story_chapters (act_id, chapter_number, title, narrative_hook, key_npcs, locations)
    VALUES (v_act1_id, 2, 'Primeras Pistas',
            'Las investigaciones llevan a los héroes a la taberna El Cáliz Roto.',
            '["lyra", "marcus"]'::jsonb,
            '["caliz_roto", "distrito_artesanos"]'::jsonb)
    ON CONFLICT (act_id, chapter_number) DO UPDATE SET title = EXCLUDED.title
    RETURNING id INTO v_chapter_id;

    INSERT INTO story_scenes (chapter_id, scene_order, scene_type, title, opening_narration, ai_context, tension_level)
    VALUES
    (v_chapter_id, 1, 'social', 'El Cáliz Roto',
     'La taberna El Cáliz Roto es un lugar acogedor. Una mujer joven de cabello oscuro sirve bebidas.',
     'Lyra es la tabernera. Secretamente aliada del príncipe.',
     'normal'),
    (v_chapter_id, 2, 'social', 'Las Deudas de Marcus',
     'Marcus es un mercader nervioso que bebe solo en una esquina.',
     'Marcus debe dinero a gente peligrosa. Vio movimientos sospechosos.',
     'normal')
    ON CONFLICT (chapter_id, scene_order) DO UPDATE SET title = EXCLUDED.title;

    -- Chapter 1.3: El Primer Giro
    INSERT INTO story_chapters (act_id, chapter_number, title, narrative_hook, key_npcs, locations)
    VALUES (v_act1_id, 3, 'El Primer Giro',
            'Cuando los héroes profundizan, descubren que el príncipe huyó voluntariamente.',
            '["varen", "asesinos"]'::jsonb,
            '["callejones", "distrito_noble"]'::jsonb)
    ON CONFLICT (act_id, chapter_number) DO UPDATE SET title = EXCLUDED.title
    RETURNING id INTO v_chapter_id;

    INSERT INTO story_scenes (chapter_id, scene_order, scene_type, title, opening_narration, ai_context, tension_level)
    VALUES
    (v_chapter_id, 1, 'combat', 'Emboscada en las Sombras',
     'El callejón se estrecha. Figuras encapuchadas emergen bloqueando ambos extremos.',
     'Combate contra 4-6 asesinos de la Orden de la Llama Negra.',
     'high'),
    (v_chapter_id, 2, 'revelation', 'La Verdad Emerge',
     'Entre los efectos de un asesino caído encontráis una carta sellada.',
     'Revelación: El príncipe Aldric no fue secuestrado, huyó voluntariamente.',
     'high')
    ON CONFLICT (chapter_id, scene_order) DO UPDATE SET title = EXCLUDED.title;

    -- Get scene ID for decision
    SELECT id INTO v_scene_id FROM story_scenes WHERE chapter_id = v_chapter_id AND scene_order = 2;

    -- Decision for trust_varen
    INSERT INTO story_decisions (scene_id, decision_code, title, description, options, consequences, affects_ending)
    VALUES (v_scene_id, 'trust_varen', 'Confianza en Lord Varen',
            'Tras el rescate, Lord Varen ofrece su ayuda directa.',
            '[
                {"id": "trust", "label": "Confiar en Lord Varen", "karma_effect": 0, "consequence_flags": ["trusted_varen"]},
                {"id": "investigate", "label": "Investigar a Lord Varen", "karma_effect": 5, "consequence_flags": ["suspicious_of_varen"]},
                {"id": "confront", "label": "Confrontar a Lord Varen", "karma_effect": 0, "consequence_flags": ["confronted_varen"]}
            ]'::jsonb,
            '{}'::jsonb,
            true)
    ON CONFLICT (decision_code) DO UPDATE SET title = EXCLUDED.title;

    -- ===========================================
    -- ACT 2: La Telaraña
    -- ===========================================
    INSERT INTO story_acts (campaign_id, act_number, title, description, objectives, estimated_sessions)
    VALUES (v_campaign_id, 2, 'La Telaraña',
            'Los héroes descubren la conspiración y buscan al príncipe fugitivo.',
            ARRAY['Descubrir la verdad sobre El Pacto Carmesí', 'Encontrar al Príncipe Aldric', 'Decidir qué hacer con la verdad'],
            5)
    ON CONFLICT (campaign_id, act_number) DO UPDATE SET title = EXCLUDED.title
    RETURNING id INTO v_act2_id;

    -- Chapters for Act 2
    INSERT INTO story_chapters (act_id, chapter_number, title, narrative_hook, key_npcs)
    VALUES
    (v_act2_id, 1, 'Senderos Bifurcados', 'La investigación toma caminos diferentes según las decisiones.', '["lyra", "varen"]'::jsonb),
    (v_act2_id, 2, 'El Pacto Revelado', 'La conspiración conocida como El Pacto Carmesí se revela.', '["informante", "nobles"]'::jsonb),
    (v_act2_id, 3, 'La Búsqueda del Príncipe', 'El camino hacia el Bosque de Sombras Eternas.', '["aldric", "lyra"]'::jsonb)
    ON CONFLICT (act_id, chapter_number) DO UPDATE SET title = EXCLUDED.title;

    -- ===========================================
    -- ACT 3: La Tormenta
    -- ===========================================
    INSERT INTO story_acts (campaign_id, act_number, title, description, objectives, estimated_sessions)
    VALUES (v_campaign_id, 3, 'La Tormenta',
            'El conflicto llega a su clímax. Traiciones se revelan.',
            ARRAY['Preparar la confrontación final', 'Descubrir la verdadera lealtad de Lyra', 'Enfrentar a Lord Varen'],
            4)
    ON CONFLICT (campaign_id, act_number) DO UPDATE SET title = EXCLUDED.title
    RETURNING id INTO v_act3_id;

    INSERT INTO story_chapters (act_id, chapter_number, title, narrative_hook, key_npcs)
    VALUES
    (v_act3_id, 1, 'El Regreso', 'Con la verdad en mano, los héroes deciden cómo proceder.', '["aldric", "isadora", "lyra"]'::jsonb),
    (v_act3_id, 2, 'La Traición Final', 'Una verdad oculta sobre Lyra cambia todo.', '["lyra", "varen"]'::jsonb),
    (v_act3_id, 3, 'Confrontación', 'El momento de enfrentar a Lord Varen.', '["varen", "aldric", "isadora"]'::jsonb)
    ON CONFLICT (act_id, chapter_number) DO UPDATE SET title = EXCLUDED.title;

    -- ===========================================
    -- ACT 4: El Nuevo Amanecer
    -- ===========================================
    INSERT INTO story_acts (campaign_id, act_number, title, description, objectives, estimated_sessions)
    VALUES (v_campaign_id, 4, 'El Nuevo Amanecer',
            'Las consecuencias dan forma al futuro de Valdoria.',
            ARRAY['Ver las consecuencias', 'Recibir reconocimiento', 'Descubrir el epílogo'],
            2)
    ON CONFLICT (campaign_id, act_number) DO UPDATE SET title = EXCLUDED.title
    RETURNING id INTO v_act4_id;

    INSERT INTO story_chapters (act_id, chapter_number, title, narrative_hook, key_npcs)
    VALUES (v_act4_id, 1, 'Consecuencias', 'El polvo se asienta sobre Valdoria.', '["aldric", "isadora"]'::jsonb)
    ON CONFLICT (act_id, chapter_number) DO UPDATE SET title = EXCLUDED.title;

    -- ===========================================
    -- NPCs
    -- ===========================================
    INSERT INTO story_npcs (campaign_id, code, name, apparent_role, true_role, description, appearance, personality, secrets, dialogue_style, relationship_default, betrayal_threshold, is_major)
    VALUES
    (v_campaign_id, 'varen', 'Lord Varen', 'ally', 'traitor',
     'Consejero Real de Valdoria',
     'Alto y delgado, cabello canoso, ojos grises calculadores',
     '{"cunning": 90, "loyalty": 10, "patience": 85, "pride": 95, "cruelty": 60, "compassion": 15}'::jsonb,
     ARRAY['Es el padre biológico del Príncipe Aldric', 'Asesinó al Rey anterior', 'Lidera el Pacto Carmesí', 'Lyra es su hermana'],
     'Formal, elegante, con dobles sentidos',
     50, NULL, true),

    (v_campaign_id, 'isadora', 'Reina Isadora', 'ally', 'ally',
     'Reina de Valdoria',
     'Cabello plateado, ojos azul profundo',
     '{"cunning": 60, "loyalty": 90, "patience": 80, "pride": 70, "compassion": 85, "honor": 90}'::jsonb,
     ARRAY['Sabe que Aldric no es su hijo biológico', 'Sospecha de Varen'],
     'Regia pero cálida',
     60, NULL, true),

    (v_campaign_id, 'lyra', 'Lyra', 'neutral', 'secret_ally',
     'Tabernera de El Cáliz Roto',
     'Cabello negro, ojos verde oscuro',
     '{"cunning": 70, "loyalty": 50, "patience": 60, "compassion": 75, "courage": 65}'::jsonb,
     ARRAY['Es hermana de Lord Varen', 'Ha sido espía del príncipe', 'Conoce los planes del Pacto'],
     'Amable pero reservada, usa el humor',
     50, 30, true),

    (v_campaign_id, 'aldric', 'Príncipe Aldric', 'ally', 'ally',
     'El príncipe heredero de Valdoria',
     'Joven de veinticinco años, cabello castaño',
     '{"cunning": 55, "loyalty": 85, "courage": 85, "compassion": 80, "honor": 90}'::jsonb,
     ARRAY['Descubrió que Varen es su padre', 'Tiene pruebas de la conspiración'],
     'Directo y apasionado',
     60, NULL, true),

    (v_campaign_id, 'marcus', 'Marcus el Mercader', 'neutral', 'neutral',
     'Un mercader caído en desgracia',
     'Hombre de mediana edad, manos temblorosas',
     '{"cunning": 40, "loyalty": 30, "courage": 20}'::jsonb,
     ARRAY['Vio movimientos sospechosos', 'Escuchó mencionar el Pacto Carmesí'],
     'Nervioso, habla rápido',
     40, NULL, false)
    ON CONFLICT (campaign_id, code) DO UPDATE SET name = EXCLUDED.name;

    -- ===========================================
    -- Clues
    -- ===========================================
    INSERT INTO story_clues (campaign_id, code, title, content, related_twist, foreshadow_hint, is_required)
    VALUES
    (v_campaign_id, 'clue_diary', 'Diario del Príncipe',
     'Referencias a El Pacto Carmesí y reuniones secretas de nobles.',
     'pacto_carmesi', 'Mencionar que el príncipe escribía constantemente.', true),
    (v_campaign_id, 'clue_medallion', 'Medallón de la Llama Negra',
     'Un medallón con el símbolo de la Orden de la Llama Negra, dejado como pista falsa.',
     'red_herring_orden', 'Mencionar rumores sobre la Orden.', false),
    (v_campaign_id, 'clue_lyra_letter', 'Carta a L',
     'Una carta inconclusa del príncipe a alguien llamado L, pidiendo ayuda.',
     'lyra_identity', 'Lyra tiene un anillo similar al del príncipe.', true),
    (v_campaign_id, 'clue_varen_seal', 'Sello de Varen',
     'El sello personal de Varen en documentos de la conspiración.',
     'varen_leader', 'Notar el anillo de sello que Varen siempre lleva.', true)
    ON CONFLICT (campaign_id, code) DO UPDATE SET title = EXCLUDED.title;

    -- ===========================================
    -- Endings
    -- ===========================================
    INSERT INTO story_endings (campaign_id, code, title, description, narration, requirements, is_good_ending, epilogue)
    VALUES
    (v_campaign_id, 'ending_a', 'El Rey Justo',
     'Aldric asciende al trono con el apoyo del pueblo.',
     'El Príncipe Aldric, ahora Rey Aldric I, es coronado ante un reino unido.',
     '{"flags": ["path_exposure", "aldric_ally"], "karma_min": 60}'::jsonb,
     true, 'El reino prospera bajo el reinado de Aldric.'),
    (v_campaign_id, 'ending_b', 'La Paz del Silencio',
     'La verdad se oculta parcialmente para evitar guerra civil.',
     'La transición es pacífica, pero las sombras del pasado nunca se disipan.',
     '{"flags": ["path_negotiation", "aldric_ally"]}'::jsonb,
     true, 'La paz reina, pero es frágil.'),
    (v_campaign_id, 'ending_c', 'El Ciclo Continúa',
     'Varen escapa, jurando venganza.',
     'La victoria sabe a cenizas. Varen ha huido con recursos y seguidores.',
     '{"flags": ["varen_escaped"]}'::jsonb,
     false, 'Un ejército se reúne en el exilio.'),
    (v_campaign_id, 'ending_d', 'La Caída',
     'La conspiración tiene éxito parcial.',
     'Las sombras ganan. Aldric vive como prisionero en su propio reino.',
     '{"flags": ["path_betrayal"]}'::jsonb,
     false, 'La resistencia continúa en secreto.')
    ON CONFLICT (campaign_id, code) DO UPDATE SET title = EXCLUDED.title;

    -- ===========================================
    -- Side Stories
    -- ===========================================
    INSERT INTO side_stories (campaign_id, code, name, description, narrative, rewards, connects_to_main, revelation_for_main)
    VALUES
    (v_campaign_id, 'fantasma_molino', 'El Fantasma del Molino',
     'Rumores de un fantasma en un viejo molino.',
     'El fantasma resulta ser un anciano que presenció el asesinato del Rey hace 20 años.',
     '{"clues": ["clue_king_murder"], "karma": 10}'::jsonb,
     true, 'Prueba del asesinato del Rey por Varen')
    ON CONFLICT (campaign_id, code) DO UPDATE SET name = EXCLUDED.name;

END $$;

-- Log completion
DO $$
BEGIN
    RAISE NOTICE 'Campaign "Las Sombras de Valdoria" seeded successfully!';
END $$;
