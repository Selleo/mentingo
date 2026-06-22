"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { useMemo } from "react";

import { colorToRgb } from "~/components/agents-ui/agent-audio-visualizer-color";
import { ReactShaderToy } from "~/components/agents-ui/react-shader-toy";
import { useAgentAudioVisualizerWave } from "~/hooks/agents-ui/use-agent-audio-visualizer-wave";
import { cn } from "~/lib/utils";

import type { AgentState, TrackReferenceOrPlaceholder } from "@livekit/components-react";
import type { LocalAudioTrack, RemoteAudioTrack } from "livekit-client";
import type { ComponentProps } from "react";

const shaderSource = `
const float TAU = 6.28318530718;

vec2 randFibo(vec2 p) {
  p = fract(p * vec2(443.897, 441.423));
  p += dot(p, p.yx + 19.19);
  return fract((p.xx + p.yx) * p.xy);
}

float luma(vec3 color) {
  return dot(color, vec3(0.299, 0.587, 0.114));
}

vec3 rgb2hsv(vec3 c) {
  vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  float e = 1.0e-10;
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

float bellCurve(float distanceFromCenter, float maxDistance) {
  float normalizedDistance = distanceFromCenter / maxDistance;
  return pow(cos(normalizedDistance * (3.14159265359 / 4.0)), 16.0);
}

float oscilloscopeWave(float x, float centerX, float time) {
  float relativeX = x - centerX;
  float maxDistance = centerX;
  float distanceFromCenter = abs(relativeX);
  float bell = bellCurve(distanceFromCenter, maxDistance);
  float wave = sin(relativeX * uFrequency + time * uSpeed) * uAmplitude * bell;
  return wave;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float centerX = 0.5;
  float centerY = 0.5;
  float x = uv.x;
  float y = uv.y;
  float pixelSize = 2.0 / (iResolution.x + iResolution.y);
  float lineWidthUV = uLineWidth * pixelSize;
  float smoothingUV = uSmoothing * pixelSize;
  const int NUM_SAMPLES = 50;
  float minDist = 1000.0;
  float sampleRange = 0.02;

  for(int i = 0; i < NUM_SAMPLES; i++) {
    float offset = (float(i) / float(NUM_SAMPLES - 1) - 0.5) * sampleRange;
    float sampleX = x + offset;
    float waveY = centerY + oscilloscopeWave(sampleX, centerX, iTime);
    vec2 wavePoint = vec2(sampleX, waveY);
    vec2 currentPoint = vec2(x, y);
    float dist = distance(currentPoint, wavePoint);
    minDist = min(minDist, dist);
  }

  float line = smoothstep(lineWidthUV + smoothingUV, lineWidthUV - smoothingUV, minDist);
  vec3 color = uColor;

  if(abs(uColorShift) > 0.01) {
    float centerBandHalfWidth = 0.2;
    float edgeBandWidth = 0.5;
    float distanceFromCenter = abs(x - centerX);
    float edgeFactor = clamp((distanceFromCenter - centerBandHalfWidth) / edgeBandWidth, 0.0, 1.0);
    vec3 hsv = rgb2hsv(color);
    hsv.x = fract(hsv.x + edgeFactor * uColorShift * 0.3);
    color = hsv2rgb(hsv);
  }

  color *= line;
  float alpha = line * uMix;
  fragColor = vec4(color * uMix, alpha);
}`;

interface WaveShaderProps {
  className?: string;
  speed?: number;
  amplitude?: number;
  frequency?: number;
  color?: string;
  colorShift?: number;
  mix?: number;
  lineWidth?: number;
  blur?: number;
}

function WaveShader({
  speed = 10,
  color = "#1FD5F9",
  colorShift = 0.05,
  mix = 1.0,
  amplitude = 0.02,
  frequency = 20.0,
  lineWidth = 2.0,
  blur = 0.5,
  ref,
  className,
  ...props
}: WaveShaderProps & ComponentProps<"div">) {
  const rgbColor = useMemo(() => colorToRgb(color), [color]);

  return (
    <div ref={ref} className={className} {...props}>
      <ReactShaderToy
        fs={shaderSource}
        devicePixelRatio={globalThis.devicePixelRatio ?? 1}
        uniforms={{
          uSpeed: { type: "1f", value: speed },
          uAmplitude: { type: "1f", value: amplitude },
          uFrequency: { type: "1f", value: frequency },
          uMix: { type: "1f", value: mix },
          uLineWidth: { type: "1f", value: lineWidth },
          uSmoothing: { type: "1f", value: blur },
          uColor: { type: "3fv", value: rgbColor },
          uColorShift: { type: "1f", value: colorShift },
        }}
        onError={(error) => {
          console.error("Shader error:", error);
        }}
        onWarning={(warning) => {
          console.warn("Shader warning:", warning);
        }}
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
}

WaveShader.displayName = "WaveShader";

export const AgentAudioVisualizerWaveVariants = cva(["aspect-square"], {
  variants: {
    size: {
      icon: "h-[24px]",
      sm: "h-[56px]",
      md: "h-[112px]",
      lg: "h-[224px]",
      xl: "h-[448px]",
    },
  },
  defaultVariants: {
    size: "lg",
  },
});

export interface AgentAudioVisualizerWaveProps {
  size?: "icon" | "sm" | "md" | "lg" | "xl";
  state?: AgentState;
  color?: string;
  colorShift?: number;
  lineWidth?: number;
  blur?: number;
  audioTrack?: LocalAudioTrack | RemoteAudioTrack | TrackReferenceOrPlaceholder;
  volumeOverride?: number;
  className?: string;
}

export function AgentAudioVisualizerWave({
  size = "lg",
  state = "speaking",
  color,
  colorShift = 0.05,
  lineWidth,
  blur,
  audioTrack,
  volumeOverride,
  className,
  ref,
  ...props
}: AgentAudioVisualizerWaveProps &
  ComponentProps<"div"> &
  VariantProps<typeof AgentAudioVisualizerWaveVariants>) {
  const resolvedLineWidth = useMemo(() => {
    if (lineWidth !== undefined) {
      return lineWidth;
    }

    switch (size) {
      case "icon":
      case "sm":
        return 2;
      default:
        return 1;
    }
  }, [lineWidth, size]);

  const { speed, amplitude, frequency, opacity } = useAgentAudioVisualizerWave({
    state,
    audioTrack,
    volumeOverride,
  });

  return (
    <WaveShader
      ref={ref}
      data-lk-state={state}
      speed={speed}
      color={color}
      colorShift={colorShift}
      mix={opacity}
      amplitude={amplitude}
      frequency={frequency}
      lineWidth={resolvedLineWidth}
      blur={blur}
      className={cn(
        AgentAudioVisualizerWaveVariants({ size }),
        "mask-[linear-gradient(90deg,transparent_0%,black_20%,black_80%,transparent_100%)]",
        className,
      )}
      {...props}
    />
  );
}
