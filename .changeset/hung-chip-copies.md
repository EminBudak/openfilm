---
"openfilm": patch
---

A render no longer waits forever on a graphics chip that hangs while it copies footage the browser can't decode or seek well (VideoToolbox does on some virtual Macs). A copy on the chip that writes nothing for 15 seconds is stopped, with no ffmpeg left running, and made on the processor; the chip's encoder is left out for the rest of the launch.
