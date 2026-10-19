#!/bin/sh
# Make the blurred, gold-tinted copy of the engagement film that plays behind the page,
# plus its first frame as a poster. The blur and tint are baked in so phones only have
# to play the video, not filter it while scrolling.
set -e
cd "$(dirname "$0")/../assets/video"
ffmpeg -y -i engagement.mp4 -an -filter_complex \
  "[0:v]scale=384:-2,gblur=sigma=9,hue=s=0.5,format=rgb24[v];color=c=0xc79d5c:s=384x216:r=30,format=rgb24[g];[v][g]blend=all_mode=normal:all_opacity=0.42:shortest=1,format=yuv420p" \
  -c:v libx264 -preset slow -crf 28 -movflags +faststart engagement-bg.mp4
ffmpeg -y -i engagement-bg.mp4 -frames:v 1 -q:v 5 engagement-bg-poster.jpg
