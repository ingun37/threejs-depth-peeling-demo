import * as React from "react";
import { useEffect } from "react";
import { three } from "../three";
import { Slider, Box, Typography } from "@mui/material";
import { range } from "fp-ts/NonEmptyArray";
import { Subject } from "rxjs";
const id = "everything";
const width = 1024;
const height = 1024;
const maxDepth = 5;
const depthRx = new Subject<number>();
export default function Everything() {
  useEffect(() => {
    three(id, width, height, depthRx);
  }, []);
  return (
    <div>
      <Typography>Depth</Typography>
      <Slider
        aria-label="Temperature"
        defaultValue={3}
        getAriaValueText={(n) => n.toString()}
        valueLabelDisplay="auto"
        step={1}
        min={1}
        max={maxDepth}
        marks={range(1, maxDepth).map((n) => ({
          value: n,
          label: n.toString(),
        }))}
        onChange={(_, v) => depthRx.next(v as number)}
      />
      <Box sx={{ width, height, backgroundColor: "black" }}>
        <div id={id} />
      </Box>
    </div>
  );
}
