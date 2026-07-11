#include <genesis.h>
#include "resources.h"

#define CITY_COUNT 4
#define MAX_MISSILES 6
#define MAX_EXPLOSIONS 3
#define PLAY_LEFT 2
#define PLAY_RIGHT 37
#define PLAY_TOP 4
#define PLAY_BOTTOM 25
#define CITY_TARGET_Y 22
#define CURSOR_MIN_X 16
#define CURSOR_MAX_X 272
#define CURSOR_MIN_Y 32
#define CURSOR_MAX_Y 152
#define MISSILE_STEP_FRAMES 16
#define MISSILE_SPAWN_FRAMES 300
#define OPENING_GRACE_FRAMES 240
#define TILE_SOLID (TILE_USER_INDEX)
#define TILE_GRID (TILE_USER_INDEX + 1)
#define TILE_MISSILE (TILE_USER_INDEX + 2)
#define TILE_BLAST (TILE_USER_INDEX + 3)
#define TILE_GROUND (TILE_USER_INDEX + 4)
#define TILE_CURSOR (TILE_USER_INDEX + 5)
#define TILE_CITY_TOP (TILE_USER_INDEX + 6)
#define TILE_CITY_BASE (TILE_USER_INDEX + 7)

typedef struct
{
    s16 x;
    s16 y;
    s16 target_x;
    u8 target_city;
    bool active;
} Missile;

typedef struct
{
    s16 x;
    s16 y;
    u8 radius;
    u8 frames;
    bool active;
} Explosion;

static const u32 presentation_tiles[64] = {
    0x11111111, 0x11111111, 0x11111111, 0x11111111,
    0x11111111, 0x11111111, 0x11111111, 0x11111111,
    0x20000000, 0x20000000, 0x20000000, 0x22222222,
    0x20000000, 0x20000000, 0x20000000, 0x22222222,
    0x00030000, 0x00033000, 0x00003300, 0x00000330,
    0x00000033, 0x00000003, 0x00000000, 0x00000000,
    0x00044000, 0x00455400, 0x04555540, 0x45555554,
    0x04555540, 0x00455400, 0x00044000, 0x00000000,
    0x00000000, 0x00060000, 0x00666000, 0x06666600,
    0x66666660, 0x66666666, 0x66666666, 0x66666666,
    0x00070000, 0x00070000, 0x77777770, 0x00070000,
    0x00070000, 0x00000000, 0x00000000, 0x00000000,
    0x00077000, 0x00777700, 0x07788770, 0x77888877,
    0x78888887, 0x77777777, 0x70000007, 0x70000007,
    0x79999997, 0x79799797, 0x79999997, 0x79799797,
    0x79999997, 0x77777777, 0x70000007, 0x77777777,
};

static const s16 city_target_x[CITY_COUNT] = {5, 14, 25, 34};
static const s16 spawn_x[] = {3, 11, 19, 28, 36, 23, 7, 32};

static Missile missiles[MAX_MISSILES];
static Explosion explosions[MAX_EXPLOSIONS];
static bool city_alive[CITY_COUNT];
static s16 cursor_x;
static s16 cursor_y;
static u16 previous_joy;
static u16 frame_counter;
static u16 spawn_counter;
static u16 opening_grace;
static u16 score;
static u8 wave;
static u8 cities_remaining;
static u8 spawn_index;
static u8 sfx_frames;
static u8 sfx_kind;
static u8 transition_frames;
static bool paused;
static bool game_over;
static bool started;

static u16 art_tile(u16 tile)
{
    return TILE_ATTR_FULL(PAL3, FALSE, FALSE, FALSE, tile);
}

static s16 absolute_value(s16 value)
{
    return value < 0 ? -value : value;
}

static void draw_text(u16 palette, s16 x, s16 y, const char *text)
{
    VDP_setTextPalette(palette);
    VDP_drawText(text, (u16)x, (u16)y);
}

static void draw_background(void)
{
    VDP_clearPlane(BG_B, TRUE);
    VDP_fillTileMapRect(BG_B, art_tile(TILE_SOLID), 0, 0, 40, 4);
    VDP_fillTileMapRect(BG_B, art_tile(TILE_GRID), PLAY_LEFT + 1, PLAY_TOP + 1,
                        PLAY_RIGHT - PLAY_LEFT - 1, PLAY_BOTTOM - PLAY_TOP - 1);
    VDP_fillTileMapRect(BG_B, art_tile(TILE_SOLID), PLAY_LEFT, PLAY_TOP,
                        PLAY_RIGHT - PLAY_LEFT + 1, 1);
    VDP_fillTileMapRect(BG_B, art_tile(TILE_SOLID), PLAY_LEFT, PLAY_BOTTOM,
                        PLAY_RIGHT - PLAY_LEFT + 1, 1);
    VDP_fillTileMapRect(BG_B, art_tile(TILE_SOLID), PLAY_LEFT, PLAY_TOP + 1,
                        1, PLAY_BOTTOM - PLAY_TOP - 1);
    VDP_fillTileMapRect(BG_B, art_tile(TILE_SOLID), PLAY_RIGHT, PLAY_TOP + 1,
                        1, PLAY_BOTTOM - PLAY_TOP - 1);
    VDP_fillTileMapRect(BG_B, art_tile(TILE_GROUND), PLAY_LEFT + 1, CITY_TARGET_Y + 1,
                        PLAY_RIGHT - PLAY_LEFT - 1, 2);
    VDP_fillTileMapRect(BG_B, art_tile(TILE_SOLID), 0, 26, 40, 2);
}

static void draw_title_screen(void)
{
    VDP_clearPlane(BG_A, TRUE);
    draw_background();
    draw_text(PAL1, 8, 7, "SKYLINE INTERCEPT");
    draw_text(PAL2, 9, 10, "DEFEND FOUR CITIES");
    draw_text(PAL1, 7, 13, "MOVE THE RADAR WITH D-PAD");
    draw_text(PAL1, 9, 15, "A OR B: INTERCEPT");
    draw_text(PAL2, 10, 19, "PRESS START OR A");
    draw_text(PAL1, 5, 27, "START PAUSE  C RESTART  SOUND MUTED");
}

static void draw_hud(void)
{
    char score_text[] = "SCORE 00000";
    char city_text[] = "CITIES 0";
    char wave_text[] = "WAVE 00";

    score_text[6] = (char)('0' + ((score / 10000) % 10));
    score_text[7] = (char)('0' + ((score / 1000) % 10));
    score_text[8] = (char)('0' + ((score / 100) % 10));
    score_text[9] = (char)('0' + ((score / 10) % 10));
    score_text[10] = (char)('0' + (score % 10));
    city_text[7] = (char)('0' + cities_remaining);
    wave_text[5] = (char)('0' + ((wave / 10) % 10));
    wave_text[6] = (char)('0' + (wave % 10));
    draw_text(PAL2, 2, 2, score_text);
    draw_text(PAL1, 17, 2, wave_text);
    draw_text(PAL2, 30, 2, city_text);
}

static void draw_city(u8 city, bool visible)
{
    const u16 x = (u16)city_target_x[city];
    if (visible)
    {
        VDP_setTileMapXY(BG_B, art_tile(TILE_CITY_TOP), x, CITY_TARGET_Y - 1);
        VDP_setTileMapXY(BG_B, art_tile(TILE_CITY_BASE), x, CITY_TARGET_Y);
        VDP_setTileMapXY(BG_B, art_tile(TILE_CITY_BASE), x + 1, CITY_TARGET_Y);
    }
    else
    {
        VDP_setTileMapXY(BG_B, art_tile(TILE_GRID), x, CITY_TARGET_Y - 1);
        VDP_setTileMapXY(BG_B, art_tile(TILE_GROUND), x, CITY_TARGET_Y);
        VDP_setTileMapXY(BG_B, art_tile(TILE_GROUND), x + 1, CITY_TARGET_Y);
    }
}

static void set_city_visibility(void)
{
    for (u8 i = 0; i < CITY_COUNT; i++) draw_city(i, city_alive[i]);
}

static void play_fire_sfx(void)
{
    PSG_setFrequency(2, 960);
    PSG_setEnvelope(2, 2);
    sfx_kind = 1;
    sfx_frames = 8;
}

static void play_blast_sfx(void)
{
    PSG_setNoise(PSG_NOISE_TYPE_WHITE, PSG_NOISE_FREQ_CLOCK4);
    PSG_setEnvelope(3, 1);
    sfx_kind = 2;
    sfx_frames = 14;
}

static void update_sfx(void)
{
    if (!sfx_frames) return;
    sfx_frames--;
    if (sfx_kind == 1 && sfx_frames)
    {
        PSG_setFrequency(2, (u16)(520 + (sfx_frames * 45)));
    }
    if (!sfx_frames)
    {
        PSG_setEnvelope(sfx_kind == 1 ? 2 : 3, PSG_ENVELOPE_MIN);
        sfx_kind = 0;
    }
}

static void create_explosion(s16 x, s16 y)
{
    for (u8 i = 0; i < MAX_EXPLOSIONS; i++)
    {
        if (!explosions[i].active)
        {
            explosions[i].x = x;
            explosions[i].y = y;
            explosions[i].radius = 1;
            explosions[i].frames = 24;
            explosions[i].active = TRUE;
            return;
        }
    }
}

static void fire_interceptor(void)
{
    create_explosion((cursor_x + 4) >> 3, (cursor_y + 4) >> 3);
    play_fire_sfx();
}

static void spawn_missile(void)
{
    for (u8 i = 0; i < MAX_MISSILES; i++)
    {
        if (!missiles[i].active)
        {
            const u8 target = (u8)((spawn_index + wave) & 3);
            missiles[i].x = spawn_x[spawn_index & 7];
            missiles[i].y = PLAY_TOP + 1;
            missiles[i].target_x = city_target_x[target];
            missiles[i].target_city = target;
            missiles[i].active = TRUE;
            spawn_index++;
            return;
        }
    }
}

static void reset_game(void)
{
    VDP_clearPlane(BG_A, TRUE);
    draw_background();
    score = 0;
    wave = 1;
    cities_remaining = CITY_COUNT;
    cursor_x = 144;
    cursor_y = 96;
    frame_counter = 0;
    spawn_counter = 0;
    opening_grace = OPENING_GRACE_FRAMES;
    spawn_index = 0;
    paused = FALSE;
    game_over = FALSE;
    previous_joy = 0;
    transition_frames = 3;
    for (u8 i = 0; i < CITY_COUNT; i++) city_alive[i] = TRUE;
    for (u8 i = 0; i < MAX_MISSILES; i++) missiles[i].active = FALSE;
    for (u8 i = 0; i < MAX_EXPLOSIONS; i++) explosions[i].active = FALSE;
    create_explosion((cursor_x + 4) >> 3, (cursor_y + 4) >> 3);
    set_city_visibility();
}

static bool missile_in_explosion(const Missile *missile, const Explosion *explosion)
{
    return absolute_value(missile->x - explosion->x) <= explosion->radius &&
           absolute_value(missile->y - explosion->y) <= explosion->radius;
}

static void update_explosions(void)
{
    for (u8 i = 0; i < MAX_EXPLOSIONS; i++)
    {
        if (!explosions[i].active) continue;
        if (explosions[i].frames > 0) explosions[i].frames--;
        if (explosions[i].frames > 16) explosions[i].radius = 1;
        else if (explosions[i].frames > 8) explosions[i].radius = 2;
        else if (explosions[i].frames > 0) explosions[i].radius = 3;
        else explosions[i].active = FALSE;
    }
}

static void update_missiles(void)
{
    for (u8 i = 0; i < MAX_MISSILES; i++)
    {
        Missile *missile = &missiles[i];
        if (!missile->active) continue;
        if ((missile->y & 1) == 0)
        {
            if (missile->x < missile->target_x) missile->x++;
            else if (missile->x > missile->target_x) missile->x--;
        }
        missile->y++;

        for (u8 blast = 0; blast < MAX_EXPLOSIONS && missile->active; blast++)
        {
            if (explosions[blast].active && missile_in_explosion(missile, &explosions[blast]))
            {
                missile->active = FALSE;
                score += 25;
                create_explosion(missile->x, missile->y);
                play_blast_sfx();
            }
        }

        if (missile->active && missile->y >= CITY_TARGET_Y)
        {
            const u8 city = missile->target_city;
            missile->active = FALSE;
            create_explosion(missile->target_x, CITY_TARGET_Y);
            play_blast_sfx();
            if (city_alive[city])
            {
                city_alive[city] = FALSE;
                cities_remaining--;
                draw_city(city, FALSE);
                if (!cities_remaining) game_over = TRUE;
            }
        }
    }
}

static void draw_dynamic(void)
{
    // Keep the radar frame, terrain, and city silhouettes on BG_B. Only the
    // dynamic overlay is cleared and redrawn during gameplay.
    VDP_fillTileMapRect(BG_A, 0, PLAY_LEFT + 1, PLAY_TOP + 1,
                        PLAY_RIGHT - PLAY_LEFT - 1, PLAY_BOTTOM - PLAY_TOP - 1);
    draw_text(PAL1, 2, 1, "SKYLINE INTERCEPT");
    draw_text(PAL1, 4, 27, "D-PAD AIM  A/B FIRE  C RESET");
    for (u8 i = 0; i < MAX_MISSILES; i++)
    {
        if (missiles[i].active)
            VDP_setTileMapXY(BG_A, art_tile(TILE_MISSILE), (u16)missiles[i].x, (u16)missiles[i].y);
    }
    for (u8 i = 0; i < MAX_EXPLOSIONS; i++)
    {
        if (!explosions[i].active) continue;
        const s16 x = explosions[i].x;
        const s16 y = explosions[i].y;
        VDP_setTileMapXY(BG_A, art_tile(TILE_BLAST), (u16)x, (u16)y);
        if (explosions[i].radius > 1)
        {
            if (x > PLAY_LEFT + 1) VDP_setTileMapXY(BG_A, art_tile(TILE_BLAST), (u16)(x - 1), (u16)y);
            if (x < PLAY_RIGHT - 1) VDP_setTileMapXY(BG_A, art_tile(TILE_BLAST), (u16)(x + 1), (u16)y);
            if (y > PLAY_TOP + 1) VDP_setTileMapXY(BG_A, art_tile(TILE_BLAST), (u16)x, (u16)(y - 1));
            if (y < CITY_TARGET_Y - 1) VDP_setTileMapXY(BG_A, art_tile(TILE_BLAST), (u16)x, (u16)(y + 1));
        }
    }
    VDP_setTileMapXY(BG_A, art_tile(TILE_CURSOR), (u16)(cursor_x >> 3), (u16)(cursor_y >> 3));
    if (paused)
    {
        draw_text(PAL2, 16, 13, "PAUSED");
    }
    if (game_over)
    {
        draw_text(PAL2, 14, 12, "CITIES LOST");
        draw_text(PAL1, 12, 14, "PRESS START TO REBUILD");
    }
    draw_hud();
}

static void read_input(void)
{
    const u16 joy = JOY_readJoypad(JOY_1);
    const u16 pressed = joy & (u16)~previous_joy;

    if (!started)
    {
        if (pressed & (BUTTON_START | BUTTON_A | BUTTON_B))
        {
            started = TRUE;
            reset_game();
        }
        previous_joy = joy;
        return;
    }

    if (pressed & BUTTON_C)
    {
        reset_game();
    }
    else if (pressed & BUTTON_START)
    {
        if (game_over)
        {
            reset_game();
        }
        else
        {
            paused = !paused;
            draw_dynamic();
        }
    }

    if (!paused && !game_over)
    {
        bool changed = FALSE;
        if ((joy & BUTTON_LEFT) && cursor_x > CURSOR_MIN_X) { cursor_x -= 2; changed = TRUE; }
        if ((joy & BUTTON_RIGHT) && cursor_x < CURSOR_MAX_X) { cursor_x += 2; changed = TRUE; }
        if ((joy & BUTTON_UP) && cursor_y > CURSOR_MIN_Y) { cursor_y -= 2; changed = TRUE; }
        if ((joy & BUTTON_DOWN) && cursor_y < CURSOR_MAX_Y) { cursor_y += 2; changed = TRUE; }
        if (pressed & (BUTTON_A | BUTTON_B))
        {
            fire_interceptor();
            changed = TRUE;
        }
        if (changed) draw_dynamic();
    }
    previous_joy = joy;
}

int main(bool hardReset)
{
    if (!hardReset) SYS_hardReset();
    VDP_setScreenWidth320();
    VDP_setBackgroundColor(0);
    PAL_setColor(0, RGB24_TO_VDPCOLOR(0x020914));
    PAL_setColor(17, RGB24_TO_VDPCOLOR(0xEAF7FF));
    PAL_setColor(18, RGB24_TO_VDPCOLOR(0x69D8FF));
    PAL_setColor(33, RGB24_TO_VDPCOLOR(0xFFB85C));
    PAL_setColor(34, RGB24_TO_VDPCOLOR(0xFFF2C2));
    PAL_setColor(49, RGB24_TO_VDPCOLOR(0x123246));
    PAL_setColor(50, RGB24_TO_VDPCOLOR(0x1B6C78));
    PAL_setColor(51, RGB24_TO_VDPCOLOR(0xFF9D38));
    PAL_setColor(52, RGB24_TO_VDPCOLOR(0xF7F4D0));
    PAL_setColor(53, RGB24_TO_VDPCOLOR(0xD12F5A));
    PAL_setColor(54, RGB24_TO_VDPCOLOR(0x27546A));
    PAL_setColor(55, RGB24_TO_VDPCOLOR(0x69D8FF));
    PAL_setColor(56, RGB24_TO_VDPCOLOR(0xFFB85C));
    PAL_setColor(57, RGB24_TO_VDPCOLOR(0xFFF2C2));
    VDP_loadTileData(presentation_tiles, TILE_SOLID, 8, CPU);
    JOY_init();
    XGM_startPlay(missile_theme);
    started = FALSE;
    draw_title_screen();

    while (TRUE)
    {
        read_input();
        update_sfx();
        if (started && transition_frames > 0)
        {
            transition_frames--;
            if (!transition_frames) draw_dynamic();
        }
        if (started && !transition_frames && !paused && !game_over)
        {
            frame_counter++;
            if (opening_grace > 0) opening_grace--;
            else spawn_counter++;
            if (frame_counter >= MISSILE_STEP_FRAMES)
            {
                frame_counter = 0;
                update_explosions();
                update_missiles();
                draw_dynamic();
            }
            if (!opening_grace && spawn_counter >= MISSILE_SPAWN_FRAMES)
            {
                spawn_counter = 0;
                spawn_missile();
                if ((spawn_index & 7) == 0 && wave < 99) wave++;
            }
        }
        SYS_doVBlankProcess();
    }
    return 0;
}
