#include <genesis.h>
#include "resources.h"

#define FIELD_LEFT 2
#define FIELD_RIGHT 37
#define FIELD_TOP 5
#define FIELD_BOTTOM 23
#define MAX_ASTEROIDS 6
#define MAX_BULLETS 5
#define STEP_FRAMES 10
#define RECOVERY_SHIELD_STEPS 18
#define TILE_SOLID TILE_USER_INDEX
#define TILE_STAR (TILE_USER_INDEX + 1)
#define TILE_ROCK (TILE_USER_INDEX + 2)
#define TILE_BULLET (TILE_USER_INDEX + 3)
#define TILE_SHIP_UP_TOP (TILE_USER_INDEX + 4)
#define TILE_SHIP_UP_BOTTOM (TILE_USER_INDEX + 5)
#define TILE_SHIP_RIGHT_BACK (TILE_USER_INDEX + 6)
#define TILE_SHIP_RIGHT_NOSE (TILE_USER_INDEX + 7)

static const u32 presentation_tiles[64] = {
    0x11111111, 0x11111111, 0x11111111, 0x11111111,
    0x11111111, 0x11111111, 0x11111111, 0x11111111,
    0x10000000, 0x00000000, 0x00000000, 0x00001000,
    0x00000000, 0x00000000, 0x00100000, 0x00000000,
    0x00000011, 0x00001122, 0x00012233, 0x00123322,
    0x01233221, 0x01232110, 0x12321100, 0x12322110,
    0x00033000, 0x00333300, 0x03322330, 0x33222233,
    0x33222233, 0x03322330, 0x00333300, 0x00033000,
    0x00000001, 0x00000012, 0x00000123, 0x00001233,
    0x00012332, 0x00123322, 0x01233222, 0x12332222,
    0x12332222, 0x12332222, 0x01233222, 0x00123322,
    0x00012332, 0x00001330, 0x00003300, 0x00003000,
    0x00000000, 0x00000000, 0x00000111, 0x00001222,
    0x03333333, 0x00001222, 0x00000111, 0x00000000,
    0x00011000, 0x00122100, 0x01233210, 0x12333321,
    0x33333333, 0x12333321, 0x01233210, 0x00122100,
};

typedef struct
{
    s16 x;
    s16 y;
    s16 dx;
    s16 dy;
    bool active;
} GameObject;

static GameObject ship;
static GameObject asteroids[MAX_ASTEROIDS];
static GameObject bullets[MAX_BULLETS];
static u16 previous_joy;
static u16 current_joy;
static u16 frame_counter;
static u16 score;
static u8 lives;
static u8 direction;
static bool started;
static bool paused;
static bool game_over;
static bool presentation_ready;
static u8 invulnerable_steps;
static u8 hit_feedback_steps;
static u8 damage_feedback_steps;

static const s16 direction_x[] = {0, 1, 0, -1};
static const s16 direction_y[] = {-1, 0, 1, 0};

static void draw_game(void);
static void erase_objects(void);
static void draw_status(void);
static void draw_objects(void);
static void draw_with_palette(u16 palette, s16 x, s16 y, const char *text);

static void clear_playfield(void)
{
    VDP_fillTileMapRect(BG_A, 0, FIELD_LEFT + 1, FIELD_TOP + 1,
                        FIELD_RIGHT - FIELD_LEFT - 1, FIELD_BOTTOM - FIELD_TOP - 1);
}

static void draw_title(void)
{
    clear_playfield();
    draw_with_palette(PAL3, 13, 9, "ASTEROIDS");
    draw_with_palette(PAL2, 10, 12, "CLEAR THE FIELD");
    draw_with_palette(PAL3, 12, 16, "PRESS START");
}

static const s16 asteroid_starts[MAX_ASTEROIDS][4] = {
    {5, 7, 1, 0},
    {31, 8, -1, 1},
    {10, 19, 1, -1},
    {34, 20, -1, 0},
    {18, 8, 0, 1},
    {25, 17, 1, 1},
};

static void draw_with_palette(u16 palette, s16 x, s16 y, const char *text)
{
    VDP_setTextPalette(palette);
    VDP_drawText(text, (u16)x, (u16)y);
}

static u16 art_tile(u16 palette, u16 tile)
{
    return TILE_ATTR_FULL(palette, FALSE, FALSE, FALSE, tile);
}

static void draw_art(s16 x, s16 y, u16 palette, u16 tile)
{
    VDP_setTileMapXY(BG_A, art_tile(palette, tile), (u16)x, (u16)y);
}

static void draw_art_flipped(s16 x, s16 y, u16 palette, u16 tile, bool hflip, bool vflip)
{
    VDP_setTileMapXY(
        BG_A,
        TILE_ATTR_FULL(palette, FALSE, vflip, hflip, tile),
        (u16)x,
        (u16)y
    );
}

static void clear_art(s16 x, s16 y)
{
    VDP_setTileMapXY(BG_A, 0, (u16)x, (u16)y);
}

static void clear_art_2x2(s16 x, s16 y)
{
    clear_art(x - 1, y - 1);
    clear_art(x, y - 1);
    clear_art(x - 1, y);
    clear_art(x, y);
}

static void draw_asteroid(s16 x, s16 y)
{
    draw_art_flipped(x - 1, y - 1, PAL1, TILE_ROCK, FALSE, FALSE);
    draw_art_flipped(x, y - 1, PAL1, TILE_ROCK, TRUE, FALSE);
    draw_art_flipped(x - 1, y, PAL1, TILE_ROCK, FALSE, TRUE);
    draw_art_flipped(x, y, PAL1, TILE_ROCK, TRUE, TRUE);
}

static void draw_ship(s16 x, s16 y, u8 facing)
{
    if (facing == 0)
    {
        draw_art_flipped(x - 1, y - 1, PAL3, TILE_SHIP_UP_TOP, FALSE, FALSE);
        draw_art_flipped(x, y - 1, PAL3, TILE_SHIP_UP_TOP, TRUE, FALSE);
        draw_art_flipped(x - 1, y, PAL3, TILE_SHIP_UP_BOTTOM, FALSE, FALSE);
        draw_art_flipped(x, y, PAL3, TILE_SHIP_UP_BOTTOM, TRUE, FALSE);
    }
    else if (facing == 2)
    {
        draw_art_flipped(x - 1, y - 1, PAL3, TILE_SHIP_UP_BOTTOM, FALSE, TRUE);
        draw_art_flipped(x, y - 1, PAL3, TILE_SHIP_UP_BOTTOM, TRUE, TRUE);
        draw_art_flipped(x - 1, y, PAL3, TILE_SHIP_UP_TOP, FALSE, TRUE);
        draw_art_flipped(x, y, PAL3, TILE_SHIP_UP_TOP, TRUE, TRUE);
    }
    else if (facing == 1)
    {
        draw_art_flipped(x - 1, y - 1, PAL3, TILE_SHIP_RIGHT_BACK, FALSE, FALSE);
        draw_art_flipped(x, y - 1, PAL3, TILE_SHIP_RIGHT_NOSE, FALSE, FALSE);
        draw_art_flipped(x - 1, y, PAL3, TILE_SHIP_RIGHT_BACK, FALSE, TRUE);
        draw_art_flipped(x, y, PAL3, TILE_SHIP_RIGHT_NOSE, FALSE, TRUE);
    }
    else
    {
        draw_art_flipped(x - 1, y - 1, PAL3, TILE_SHIP_RIGHT_NOSE, TRUE, FALSE);
        draw_art_flipped(x, y - 1, PAL3, TILE_SHIP_RIGHT_BACK, TRUE, FALSE);
        draw_art_flipped(x - 1, y, PAL3, TILE_SHIP_RIGHT_NOSE, TRUE, TRUE);
        draw_art_flipped(x, y, PAL3, TILE_SHIP_RIGHT_BACK, TRUE, TRUE);
    }
}

static void wrap(GameObject *object)
{
    if (object->x < FIELD_LEFT + 2) object->x = FIELD_RIGHT - 2;
    if (object->x > FIELD_RIGHT - 2) object->x = FIELD_LEFT + 2;
    if (object->y < FIELD_TOP + 2) object->y = FIELD_BOTTOM - 2;
    if (object->y > FIELD_BOTTOM - 2) object->y = FIELD_TOP + 2;
}

static void reset_game(void)
{
    ship.x = 20;
    ship.y = 14;
    ship.dx = 0;
    ship.dy = 0;
    ship.active = TRUE;
    direction = 0;
    score = 0;
    lives = 3;
    paused = FALSE;
    game_over = FALSE;
    frame_counter = 0;
    current_joy = 0;
    /* Give a new or restarted run three seconds to orient before damage. */
    invulnerable_steps = RECOVERY_SHIELD_STEPS;
    hit_feedback_steps = 0;
    damage_feedback_steps = 0;

    for (u8 i = 0; i < MAX_ASTEROIDS; i++)
    {
        asteroids[i].x = asteroid_starts[i][0];
        asteroids[i].y = asteroid_starts[i][1];
        asteroids[i].dx = asteroid_starts[i][2];
        asteroids[i].dy = asteroid_starts[i][3];
        asteroids[i].active = TRUE;
    }
    for (u8 i = 0; i < MAX_BULLETS; i++) bullets[i].active = FALSE;
}

static void fire_bullet(void)
{
    for (u8 i = 0; i < MAX_BULLETS; i++)
    {
        if (!bullets[i].active)
        {
            bullets[i].x = ship.x;
            bullets[i].y = ship.y;
            bullets[i].dx = direction_x[direction];
            bullets[i].dy = direction_y[direction];
            bullets[i].active = TRUE;
            return;
        }
    }
}

static void read_input(void)
{
    const u16 joy = JOY_readJoypad(JOY_1);
    const u16 pressed = joy & ~previous_joy;
    current_joy = joy;

    if (!started)
    {
        if (pressed & BUTTON_START)
        {
            started = TRUE;
            clear_playfield();
            reset_game();
            draw_status();
            draw_objects();
        }
        previous_joy = joy;
        return;
    }

    if ((pressed & BUTTON_C) && !game_over)
    {
        paused = !paused;
        if (paused) draw_with_palette(PAL2, 17, 14, "PAUSED");
        else
        {
            clear_playfield();
            draw_objects();
        }
    }
    if (pressed & BUTTON_START)
    {
        erase_objects();
        clear_playfield();
        reset_game();
        draw_status();
        draw_objects();
    }
    if (!game_over && !paused)
    {
        if (pressed & BUTTON_A) fire_bullet();
    }
    previous_joy = joy;
}

static bool overlaps(const GameObject *left, const GameObject *right)
{
    s16 dx = left->x - right->x;
    s16 dy = left->y - right->y;
    if (dx < 0) dx = -dx;
    if (dy < 0) dy = -dy;
    return dx <= 1 && dy <= 1;
}

static void step_game(void)
{
    if (current_joy & BUTTON_LEFT) direction = (direction + 3) & 3;
    else if (current_joy & BUTTON_RIGHT) direction = (direction + 1) & 3;

    if (current_joy & BUTTON_UP)
    {
        ship.dx = direction_x[direction];
        ship.dy = direction_y[direction];
    }
    else
    {
        ship.dx = 0;
        ship.dy = 0;
    }

    ship.x += ship.dx;
    ship.y += ship.dy;
    wrap(&ship);
    ship.dx = 0;
    ship.dy = 0;

    for (u8 i = 0; i < MAX_ASTEROIDS; i++)
    {
        if (!asteroids[i].active) continue;
        asteroids[i].x += asteroids[i].dx;
        asteroids[i].y += asteroids[i].dy;
        wrap(&asteroids[i]);

        if (invulnerable_steps == 0 && overlaps(&ship, &asteroids[i]))
        {
            if (lives > 0) lives--;
            ship.x = 20;
            ship.y = 14;
            invulnerable_steps = 12;
            damage_feedback_steps = 6;
            if (lives == 0)
            {
                game_over = TRUE;
                damage_feedback_steps = 0;
            }
        }
    }

    for (u8 bullet = 0; bullet < MAX_BULLETS; bullet++)
    {
        if (!bullets[bullet].active) continue;
        bullets[bullet].x += bullets[bullet].dx;
        bullets[bullet].y += bullets[bullet].dy;
        if (bullets[bullet].x <= FIELD_LEFT || bullets[bullet].x >= FIELD_RIGHT ||
            bullets[bullet].y <= FIELD_TOP || bullets[bullet].y >= FIELD_BOTTOM)
        {
            bullets[bullet].active = FALSE;
            continue;
        }

        for (u8 asteroid = 0; asteroid < MAX_ASTEROIDS; asteroid++)
        {
            if (asteroids[asteroid].active && overlaps(&bullets[bullet], &asteroids[asteroid]))
            {
                asteroids[asteroid].active = FALSE;
                bullets[bullet].active = FALSE;
                score += 10;
                hit_feedback_steps = 5;
                break;
            }
        }
    }

    if (invulnerable_steps > 0) invulnerable_steps--;
}

static void draw_status(void)
{
    char score_text[] = "SCORE 0000";
    char lives_text[] = "LIVES 0";

    score_text[6] = (char)('0' + ((score / 1000) % 10));
    score_text[7] = (char)('0' + ((score / 100) % 10));
    score_text[8] = (char)('0' + ((score / 10) % 10));
    score_text[9] = (char)('0' + (score % 10));
    lives_text[6] = (char)('0' + lives);
    draw_with_palette(0, 3, 3, score_text);
    draw_with_palette(0, 30, 3, lives_text);
}

static void erase_objects(void)
{
    clear_art_2x2(ship.x, ship.y);
    for (u8 i = 0; i < MAX_ASTEROIDS; i++)
        if (asteroids[i].active) clear_art_2x2(asteroids[i].x, asteroids[i].y);
    for (u8 i = 0; i < MAX_BULLETS; i++)
        if (bullets[i].active) clear_art(bullets[i].x, bullets[i].y);
}

static void draw_objects(void)
{
    for (u8 i = 0; i < MAX_ASTEROIDS; i++)
        if (asteroids[i].active) draw_asteroid(asteroids[i].x, asteroids[i].y);
    for (u8 i = 0; i < MAX_BULLETS; i++)
        if (bullets[i].active) draw_art(bullets[i].x, bullets[i].y, PAL2, TILE_BULLET);
    if (invulnerable_steps == 0 || (invulnerable_steps & 1) == 0)
        draw_ship(ship.x, ship.y, direction);

    if (hit_feedback_steps > 0)
    {
        draw_with_palette(PAL2, 16, 4, "HIT +10");
        hit_feedback_steps--;
    }
    else draw_with_palette(PAL2, 16, 4, "       ");

    if (!game_over && damage_feedback_steps > 0)
    {
        draw_with_palette(PAL2, 15, 22, "HULL HIT");
        damage_feedback_steps--;
    }
    else draw_with_palette(PAL2, 15, 22, "        ");

    if (game_over)
    {
        draw_with_palette(2, 15, 13, "GAME OVER");
        draw_with_palette(2, 14, 15, "PRESS START");
    }
}

static void draw_game(void)
{
    if (!presentation_ready)
    {
        VDP_clearPlane(BG_A, TRUE);
        VDP_clearPlane(BG_B, TRUE);
        VDP_fillTileMapRect(BG_B, art_tile(PAL3, TILE_SOLID), 0, 0, 40, 4);
        VDP_fillTileMapRect(BG_B, art_tile(PAL1, TILE_STAR), FIELD_LEFT + 1, FIELD_TOP + 1,
                            FIELD_RIGHT - FIELD_LEFT - 1, FIELD_BOTTOM - FIELD_TOP - 1);
        draw_with_palette(PAL3, 10, 1, "DRIVE16 // ASTEROIDS");

        VDP_fillTileMapRect(BG_A, art_tile(PAL3, TILE_SOLID), FIELD_LEFT, FIELD_TOP,
                            FIELD_RIGHT - FIELD_LEFT + 1, 1);
        VDP_fillTileMapRect(BG_A, art_tile(PAL3, TILE_SOLID), FIELD_LEFT, FIELD_BOTTOM,
                            FIELD_RIGHT - FIELD_LEFT + 1, 1);
        VDP_fillTileMapRect(BG_A, art_tile(PAL3, TILE_SOLID), FIELD_LEFT, FIELD_TOP + 1,
                            1, FIELD_BOTTOM - FIELD_TOP - 1);
        VDP_fillTileMapRect(BG_A, art_tile(PAL3, TILE_SOLID), FIELD_RIGHT, FIELD_TOP + 1,
                            1, FIELD_BOTTOM - FIELD_TOP - 1);

        VDP_fillTileMapRect(BG_B, art_tile(PAL3, TILE_SOLID), 0, 25, 40, 4);
        draw_with_palette(PAL3, 3, 26, "LEFT/RIGHT TURN  UP THRUST  A FIRE");
        draw_with_palette(PAL3, 9, 27, "C PAUSE  START RESTART");
        presentation_ready = TRUE;
    }
    else
    {
        erase_objects();
    }
    draw_status();
    draw_objects();
}

int main(bool hardReset)
{
    (void)hardReset;
    VDP_setScreenWidth320();
    PAL_setColor(0, RGB24_TO_VDPCOLOR(0x081020));
    PAL_setColor(17, RGB24_TO_VDPCOLOR(0x66738C));
    PAL_setColor(18, RGB24_TO_VDPCOLOR(0x303A52));
    PAL_setColor(19, RGB24_TO_VDPCOLOR(0xAAB2C6));
    PAL_setColor(31, RGB24_TO_VDPCOLOR(0xE8EDF7));
    PAL_setColor(33, RGB24_TO_VDPCOLOR(0xFF9E3D));
    PAL_setColor(34, RGB24_TO_VDPCOLOR(0xB84A3A));
    PAL_setColor(35, RGB24_TO_VDPCOLOR(0xFFF0A8));
    PAL_setColor(47, RGB24_TO_VDPCOLOR(0xFFF0A8));
    PAL_setColor(49, RGB24_TO_VDPCOLOR(0x45C6D8));
    PAL_setColor(50, RGB24_TO_VDPCOLOR(0x176784));
    PAL_setColor(51, RGB24_TO_VDPCOLOR(0xD2FCFF));
    PAL_setColor(63, RGB24_TO_VDPCOLOR(0xF4FCFF));
    VDP_setBackgroundColor(0);
    VDP_loadTileData(presentation_tiles, TILE_SOLID, 8, CPU);
    VDP_setTextPalette(PAL3);
    VDP_clearPlane(BG_A, TRUE);
    VDP_clearPlane(BG_B, TRUE);
    XGM_startPlay(asteroids_music);
    reset_game();
    draw_game();
    started = FALSE;
    draw_title();

    while (TRUE)
    {
        read_input();
        if (started && !paused && !game_over && ++frame_counter >= STEP_FRAMES)
        {
            frame_counter = 0;
            erase_objects();
            step_game();
            draw_status();
            draw_objects();
        }
        SYS_doVBlankProcess();
    }
    return 0;
}
