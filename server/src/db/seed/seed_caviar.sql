-- seed_caviar.sql — the 12 products from the frontend catalogue.
-- Run AFTER migrations, against the caviar-cellar database (UTF-8).
-- Keeps the frontend ids (1..12) so DB ids line up with the static catalogue.

BEGIN;

INSERT INTO caviar
    (caviar_id, title, manufacturer_country, fish, description,
     net_weight_grams, price_uah, amount, rel_image_path)
OVERRIDING SYSTEM VALUE
VALUES
    (1,  'Royal Beluga Reserve',     'США',      'Белуга',
     'Добірна чорна ікра з великими ніжними ікринками, м’яким вершковим смаком і тривалим морським післясмаком.',
     200, 2699, 2, 'royal-beluga-reserve.png'),
    (2,  'Nordic Sevruga Classic',   'Норвегія', 'Севрюга',
     'Дрібнозерниста чорна ікра з виразним солонуватим смаком, легкою горіховою нотою та делікатним ароматом моря.',
     250, 2399, 0, 'nordic-sevruga-classic.png'),
    (3,  'Icelandic Trout Pearl',    'Ісландія', 'Форель',
     'Яскрава ікра форелі з пружними ікринками, помірною солоністю та свіжим морським ароматом.',
     300, 1599, 4, 'maple_coast-trout-roe.png'),
    (4,  'Canadian Chum Select',     'Канада',   'Кета',
     'Велика червона ікра кети з тонкою оболонкою, соковитою текстурою та насиченим класичним смаком.',
     350, 1899, 1, 'canadian_chum_select.png'),
    (5,  'Alaska Salmon Gold',       'США',      'Лосось',
     'Добірна лососева ікра золотисто-помаранчевого кольору з чистим смаком і легкими солодкуватими нотами.',
     400, 2099, 3, 'alaska_salmon_gold.png'),
    (6,  'Fjord Trout Premium',      'Норвегія', 'Форель',
     'Ніжна ікра форелі з рівномірними ікринками, делікатною солоністю та м’яким вершковим післясмаком.',
     450, 1799, 2, 'fjord_trout_premium.png'),
    (7,  'Arctic Chum Caviar',       'Ісландія', 'Кета',
     'Преміальна ікра кети з великим зерном, щільною текстурою та виразним морським смаком.',
     500, 2299, 0, 'arctic_chum_caviar.png'),
    (8,  'Northern Salmon Crown',    'Канада',   'Лосось',
     'Натуральна ікра лосося з соковитими ікринками, помірною солоністю та приємним свіжим ароматом.',
     600, 2599, 4, 'northern_salmon_crown.png'),
    (9,  'Black Pearl Sevruga',      'США',      'Севрюга',
     'Вишукана чорна ікра з дрібним зерном, інтенсивним смаком і тонкими мінеральними відтінками.',
     300, 2499, 1, 'black_pearl_sevruga.png'),
    (10, 'Norwegian Beluga Heritage','Норвегія', 'Белуга',
     'Велика ікра белуги з шовковистою текстурою, ніжним смаком і легким горіхово-вершковим післясмаком.',
     250, 2649, 3, 'norwegian_beluga_heritage.png'),
    (11, 'Iceland Salmon Aurora',    'Ісландія', 'Лосось',
     'Яскрава лососева ікра з пружною оболонкою, збалансованою солоністю та чистим арктичним смаком.',
     350, 1699, 2, 'iceland_salmon_aurora.png'),
    (12, 'Maple Coast Trout Roe',    'Канада',   'Форель',
     'Свіжа ікра форелі з насиченим помаранчевим кольором, легкою солоністю та делікатним післясмаком.',
     400, 1399, 0, 'maple_coast-trout-roe.png');

-- Advance the identity sequence so the next auto id is MAX+1 (= 13).
SELECT setval(
    pg_get_serial_sequence('caviar', 'caviar_id'),
    (SELECT MAX(caviar_id) FROM caviar)
);

COMMIT;
