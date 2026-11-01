#!/bin/zsh
# Re-encode assets/music-src/ into assets/music/ (80 kbps AAC, 2 s crossfade baked into each loop's seam).
cd "$(dirname "$0")/../assets/music-src" || exit 1
FF=/opt/homebrew/bin/ffmpeg; X=2
loopenc(){ in="$1"; L=$(/opt/homebrew/bin/ffprobe -v error -show_entries format=duration -of csv=p=0 "$in"); M=$(echo "$L-$X"|bc)
$FF -v error -y -i "$in" -filter_complex "[0]atrim=0:${X},asetpts=PTS-STARTPTS[h];[0]atrim=${X}:${M},asetpts=PTS-STARTPTS[b];[0]atrim=${M}:${L},asetpts=PTS-STARTPTS[t];[t][h]acrossfade=d=${X}[x];[b][x]concat=n=2:v=0:a=1[o]" -map "[o]" -ac 2 -ar 44100 -c:a aac -b:a 80k -movflags +faststart "../music/$2.m4a"; }
loopenc lvl_6_the_beach.mp3 beach; loopenc lvl_7_the_raft_on_the_ocean.mp3 raft; loopenc lvl_2_the_village.mp3 village
loopenc lvl_5_the_oasis_or_resting_place.mp3 oasis; loopenc lvl_3_the_grassland_0.mp3 grassland
loopenc beary_fishy_menu_screen_by_memoraphile_CC0.mp3 menu; loopenc gone_fishin_by_memoraphile_CC0_0.mp3 gonefishin; loopenc slow_stride_loop.ogg slowstride
$FF -v error -y -i the_reel_winner_by_memoraphile_CC0.mp3 -ac 2 -ar 44100 -c:a aac -b:a 96k -movflags +faststart ../music/reelwinner.m4a
