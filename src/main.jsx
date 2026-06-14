import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Activity, Aperture, Camera, Hand, LoaderCircle, Sparkles, Volume2, Zap } from 'lucide-react';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import './styles.css';

const GESTURES = {
  none: {
    label: 'Scanning',
    mode: 'Idle',
    hint: 'Raise one hand into frame',
    tone: '#77f6ff',
  },
  openPalm: {
    label: 'Open Palm',
    mode: 'Neutral Palm',
    hint: 'Only releases after prayer talismans',
    tone: '#8bd8ff',
  },
  circleOfuda: {
    label: 'Held Ofuda',
    mode: 'Single Talisman',
    hint: 'Circle to create, fist then open palm to release',
    tone: '#ffe6a6',
  },
  ofudaStrike: {
    label: 'Ofuda Strike',
    mode: 'Forward Exorcism',
    hint: 'Open palm to release collected talismans',
    tone: '#ffe6a6',
  },
  fireCharge: {
    label: 'Fire Circle',
    mode: 'Fireball Charging',
    hint: 'Hold both hands in an O shape',
    tone: '#ff9f43',
  },
  fireLaunch: {
    label: 'Fireball',
    mode: 'Released',
    hint: 'Fireball launched forward',
    tone: '#ff6b35',
  },
  pointing: {
    label: 'Finger Gun',
    mode: 'Green Bullet',
    hint: 'Thumb up, finger barrel toward camera',
    tone: '#57ff8a',
  },
};

const FINGER_TIPS = [8, 12, 16, 20];
const FINGER_PIPS = [6, 10, 14, 18];
const OFUDA_MARKS = ['封', '祓', '霊', '結', '護', '浄'];
const MAX_RENDER_DPR = 1;
const TRACKING_INTERVAL_MS = 50;

function classifyGesture(landmarks) {
  if (!landmarks?.length) return 'none';

  const wrist = landmarks[0];
  const indexMcp = landmarks[5];
  const middleMcp = landmarks[9];
  const handScale = distance(wrist, middleMcp) || 0.001;
  const extended = FINGER_TIPS.map((tipIndex, i) => {
    const tip = landmarks[tipIndex];
    const pip = landmarks[FINGER_PIPS[i]];
    const mcp = landmarks[[5, 9, 13, 17][i]];
    const straightness = distance(tip, mcp) / handScale;
    return tip.y < pip.y - 0.025 && straightness > 0.78;
  });

  const thumbTip = landmarks[4];
  const thumbIp = landmarks[3];
  const thumbExtended =
    distance(thumbTip, indexMcp) / handScale > 0.8 &&
    (Math.abs(thumbTip.x - thumbIp.x) > 0.025 || thumbTip.y < landmarks[2].y - 0.035);

  const extendedCount = extended.filter(Boolean).length + (thumbExtended ? 1 : 0);
  const [index, middle, ring, pinky] = extended;

  if (extendedCount >= 4) return 'openPalm';
  if (index && !middle && !ring && !pinky) return 'pointing';
  if (extendedCount <= 1) return 'fist';
  return 'none';
}

function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = (a.z || 0) - (b.z || 0);
  return Math.hypot(dx, dy, dz);
}

function landmarkToCanvas(point, width, height) {
  return {
    x: (1 - point.x) * width,
    y: point.y * height,
  };
}

function analyzeHand(landmarks, width, height, handLabel = 'Unknown', palmMode = 'inverted') {
  if (!landmarks?.length) return null;

  const wrist = landmarkToCanvas(landmarks[0], width, height);
  const center = landmarkToCanvas(landmarks[9], width, height);
  const indexTip = landmarkToCanvas(landmarks[8], width, height);
  const middleTip = landmarkToCanvas(landmarks[12], width, height);
  const thumbTip = landmarkToCanvas(landmarks[4], width, height);
  const rawGesture = classifyGesture(landmarks);
  const scale = distance(landmarks[0], landmarks[9]) || 0.001;
  const palmWidth = distance(landmarks[5], landmarks[17]) / scale;
  const palmHeight = distance(landmarks[0], landmarks[9]) / scale;
  const extended = FINGER_TIPS.map((tipIndex, i) => {
    const tip = landmarks[tipIndex];
    const pip = landmarks[FINGER_PIPS[i]];
    const mcp = landmarks[[5, 9, 13, 17][i]];
    return tip.y < pip.y + 0.01 && distance(tip, mcp) / scale > 0.68;
  });
  const [index, middle] = extended;
  const extendedFingers = extended.filter(Boolean).length;
  const fingerSpread =
    (distance(landmarks[8], landmarks[12]) + distance(landmarks[12], landmarks[16]) + distance(landmarks[16], landmarks[20])) /
    scale;
  const thumbIndexGap = distance(landmarks[4], landmarks[8]) / scale;
  const indexMiddleGap = distance(landmarks[8], landmarks[12]) / scale;
  const indexLength = distance(landmarks[5], landmarks[8]) / scale;
  const projectedIndexLength = Math.hypot(landmarks[8].x - landmarks[5].x, landmarks[8].y - landmarks[5].y) / scale;
  const projectedMiddleLength = Math.hypot(landmarks[12].x - landmarks[9].x, landmarks[12].y - landmarks[9].y) / scale;
  const indexCurled = landmarks[8].y > landmarks[6].y - 0.005 || distance(landmarks[8], landmarks[5]) / scale < 0.72;
  const middleCurled = landmarks[12].y > landmarks[10].y - 0.005 || distance(landmarks[12], landmarks[9]) / scale < 0.72;
  const ringCurled = landmarks[16].y > landmarks[14].y - 0.005 || distance(landmarks[16], landmarks[13]) / scale < 0.72;
  const pinkyCurled = landmarks[20].y > landmarks[18].y - 0.005 || distance(landmarks[20], landmarks[17]) / scale < 0.72;
  const thumbUp = landmarks[4].y < landmarks[3].y - 0.05 && landmarks[4].y < landmarks[2].y - 0.08;
  const barrelTowardCamera = indexLength < 0.9 && Math.abs(landmarks[8].x - landmarks[5].x) < 0.16;
  const fingerGun =
    (rawGesture === 'pointing' && thumbIndexGap > 0.58) ||
    (thumbUp && barrelTowardCamera && middleCurled && ringCurled && pinkyCurled);
  const fistOfuda =
    rawGesture === 'fist' &&
    extendedFingers === 0 &&
    indexCurled &&
    middleCurled &&
    ringCurled &&
    pinkyCurled &&
    !thumbUp &&
    !fingerGun;
  const fingersTogether = fingerSpread < 1.72;
  const openHandLike = extendedFingers >= 2;
  const thumbOnPalmSide =
    handLabel === 'Right'
      ? landmarks[4].x > landmarks[17].x
      : handLabel === 'Left'
        ? landmarks[4].x < landmarks[17].x
        : thumbIndexGap > 0.45;
  const calibratedPalmSide = palmMode === 'inverted' ? !thumbOnPalmSide : thumbOnPalmSide;
  const palmFacingCamera = openHandLike && fingersTogether && palmWidth > 0.52 && calibratedPalmSide;
  const palmUp = openHandLike && fingersTogether && !palmFacingCamera && (projectedIndexLength < 0.92 || projectedMiddleLength < 0.92);
  const palmTurnedAway = openHandLike && fingersTogether && !palmFacingCamera;
  const compactOpenPalm = palmFacingCamera;

  return {
    landmarks,
    handLabel,
    rawGesture,
    gesture: fingerGun ? 'pointing' : rawGesture,
    compactOpenPalm,
    fingerGun,
    fistOfuda,
    openHandLike,
    palmFacingCamera,
    palmUp,
    palmTurnedAway,
    center,
    wrist,
    indexTip,
    middleTip,
    thumbTip,
    direction: normalizeVector(indexTip.x - wrist.x, indexTip.y - wrist.y),
    scale,
    palmWidth,
    palmHeight,
    fingerSpread,
    indexMiddleGap,
  };
}

function normalizeVector(x, y) {
  const length = Math.hypot(x, y) || 1;
  return { x: x / length, y: y / length };
}

function getTwoHandGesture(hands) {
  if (hands.length < 2) return null;
  const [a, b] = hands;
  const centerDistance = Math.hypot(a.center.x - b.center.x, a.center.y - b.center.y);
  const indexDistance = Math.hypot(a.indexTip.x - b.indexTip.x, a.indexTip.y - b.indexTip.y);
  const thumbDistance = Math.hypot(a.thumbTip.x - b.thumbTip.x, a.thumbTip.y - b.thumbTip.y);
  const averageScale = ((a.scale + b.scale) / 2) * 900;

  const makesO =
    indexDistance < averageScale * 1.45 &&
    thumbDistance < averageScale * 1.65 &&
    centerDistance > averageScale * 1.2 &&
    centerDistance < averageScale * 4.1;
  if (makesO) return 'fireCharge';
  return null;
}

function updateCircleTrail(trail, point, now) {
  trail.push({ x: point.x, y: point.y, at: now });
  while (trail.length > 32 || (trail[0] && now - trail[0].at > 1500)) {
    trail.shift();
  }
}

function detectCircleGesture(trail) {
  if (trail.length < 12) return false;
  const center = trail.reduce((acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }), { x: 0, y: 0 });
  center.x /= trail.length;
  center.y /= trail.length;

  let pathLength = 0;
  let radiusSum = 0;
  let angleTravel = 0;
  let previousAngle = Math.atan2(trail[0].y - center.y, trail[0].x - center.x);

  for (let i = 1; i < trail.length; i += 1) {
    const prev = trail[i - 1];
    const point = trail[i];
    pathLength += Math.hypot(point.x - prev.x, point.y - prev.y);
    radiusSum += Math.hypot(point.x - center.x, point.y - center.y);

    const angle = Math.atan2(point.y - center.y, point.x - center.x);
    let delta = angle - previousAngle;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    angleTravel += Math.abs(delta);
    previousAngle = angle;
  }

  const averageRadius = radiusSum / Math.max(1, trail.length - 1);
  return averageRadius > 18 && averageRadius < 170 && pathLength > 150 && angleTravel > Math.PI * 1.15;
}

function detectUpwardWave(trail) {
  if (trail.length < 4) return false;
  const current = trail[trail.length - 1];
  const previous = [...trail].reverse().find((point) => current.at - point.at > 180 && current.at - point.at < 520);
  if (!previous) return false;
  return previous.y - current.y > 58 && Math.abs(previous.x - current.x) < 170;
}

function updateHudState(uiStateRef, gestureRef, setGesture, setHandPoint, gesture, canvasPoint, dpr) {
  const now = performance.now();
  const nextPoint = canvasPoint ? { x: Math.round(canvasPoint.x / dpr), y: Math.round(canvasPoint.y / dpr) } : null;
  const previous = uiStateRef.current;
  const pointChanged =
    (nextPoint && !previous.handPoint) ||
    (!nextPoint && previous.handPoint) ||
    (nextPoint &&
      previous.handPoint &&
      (Math.abs(nextPoint.x - previous.handPoint.x) > 18 || Math.abs(nextPoint.y - previous.handPoint.y) > 18));

  if (gesture !== previous.gesture) {
    previous.gesture = gesture;
    gestureRef.current = gesture;
    setGesture(gesture);
  }

  if (pointChanged && now - previous.lastUpdate > 120) {
    previous.handPoint = nextPoint;
    previous.lastUpdate = now;
    setHandPoint(nextPoint);
  }
}

function useSoundEngine(enabled) {
  const audioRef = useRef(null);
  const lastPlayedRef = useRef({ gesture: 'none', at: 0 });

  return useMemo(() => {
    const ensureAudio = () => {
      if (!enabled) return null;
      if (!audioRef.current) {
        audioRef.current = new AudioContext();
      }
      if (audioRef.current.state === 'suspended') {
        audioRef.current.resume();
      }
      return audioRef.current;
    };

    const playGesture = (gesture) => {
      if (gesture === 'none') return;
      const now = performance.now();
      const previous = lastPlayedRef.current;
      if (previous.gesture === gesture && now - previous.at < 1250) return;
      lastPlayedRef.current = { gesture, at: now };

      const ctx = ensureAudio();
      if (!ctx) return;

      const master = ctx.createGain();
      master.gain.setValueAtTime(0.0001, ctx.currentTime);
      master.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.025);
      master.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.55);
      master.connect(ctx.destination);

      const oscillator = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      oscillator.type = 'sine';
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(gesture === 'pointing' ? 2400 : 900, ctx.currentTime);
      filter.Q.value = 7;

      const startFrequency = gesture === 'circleOfuda' ? 220 : 520;
      const endFrequency = gesture === 'circleOfuda' ? 580 : 1200;
      oscillator.frequency.setValueAtTime(startFrequency, ctx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(endFrequency, ctx.currentTime + 0.34);
      oscillator.connect(filter);
      filter.connect(master);
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.56);

      const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.22, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      }
      const noise = ctx.createBufferSource();
      const noiseGain = ctx.createGain();
      noise.buffer = noiseBuffer;
      noiseGain.gain.value = gesture === 'pointing' ? 0.08 : 0.035;
      noise.connect(noiseGain);
      noiseGain.connect(master);
      noise.start();
    };

    return { playGesture };
  }, [enabled]);
}

function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const animationRef = useRef(0);
  const landmarkerRef = useRef(null);
  const particlesRef = useRef([]);
  const beamsRef = useRef([]);
  const talismansRef = useRef([]);
  const projectilesRef = useRef([]);
  const impactsRef = useRef([]);
  const floatingTextsRef = useRef([]);
  const handMotionRef = useRef({ scale: 0, point: null, at: 0, lastOfudaThrow: 0, lastBullet: 0, fingerGunBlockedUntil: 0 });
  const ofudaReadyRef = useRef({ active: false, armed: false, at: 0, fistAt: 0, handLabel: null });
  const circleTrailRef = useRef([]);
  const fireChargeRef = useRef({ active: false, center: null, radius: 0, lastLaunch: 0 });
  const analyzedHandsRef = useRef([]);
  const uiStateRef = useRef({ gesture: 'none', handPoint: null, lastUpdate: 0 });
  const lastVideoTimeRef = useRef(-1);
  const lastTrackingAtRef = useRef(0);
  const smoothedPointRef = useRef(null);

  const [status, setStatus] = useState('准备启动摄像头');
  const [gesture, setGesture] = useState('none');
  const [handPoint, setHandPoint] = useState(null);
  const [isSoundOn, setIsSoundOn] = useState(true);
  const [permissionRequested, setPermissionRequested] = useState(false);
  const gestureRef = useRef('none');
  const soundEngine = useSoundEngine(isSoundOn);

  useEffect(() => {
    let cancelled = false;
    let stream;

    async function boot() {
      try {
        setStatus('加载手部识别模型');
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm',
        );
        let landmarker;
        const landmarkerOptions = {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numHands: 2,
          minHandDetectionConfidence: 0.55,
          minHandPresenceConfidence: 0.55,
          minTrackingConfidence: 0.55,
        };

        try {
          landmarker = await HandLandmarker.createFromOptions(vision, landmarkerOptions);
        } catch (gpuError) {
          console.warn('GPU delegate unavailable, falling back to CPU.', gpuError);
          landmarker = await HandLandmarker.createFromOptions(vision, {
            ...landmarkerOptions,
            baseOptions: {
              ...landmarkerOptions.baseOptions,
              delegate: 'CPU',
            },
          });
        }

        if (cancelled) return;
        landmarkerRef.current = landmarker;
        setStatus('等待摄像头权限');
        setPermissionRequested(true);

        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 360 },
            facingMode: 'user',
          },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setStatus('手势识别运行中');
      } catch (error) {
        console.error(error);
        setStatus(error?.name === 'NotAllowedError' ? '摄像头权限被拒绝' : '启动失败，请检查浏览器权限或网络');
      }
    }

    boot();

    return () => {
      cancelled = true;
      cancelAnimationFrame(animationRef.current);
      if (stream) stream.getTracks().forEach((track) => track.stop());
      if (landmarkerRef.current) landmarkerRef.current.close();
    };
  }, []);

  useEffect(() => {
    let rafId;
    const render = () => {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      const landmarker = landmarkerRef.current;
      if (!canvas || !video) {
        rafId = requestAnimationFrame(render);
        return;
      }

      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_RENDER_DPR);
      if (canvas.width !== Math.floor(rect.width * dpr) || canvas.height !== Math.floor(rect.height * dpr)) {
        canvas.width = Math.floor(rect.width * dpr);
        canvas.height = Math.floor(rect.height * dpr);
      }

      const ctx = canvas.getContext('2d');
      const width = canvas.width;
      const height = canvas.height;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, width, height);

      let activeGesture = gestureRef.current;
      let canvasPoint = smoothedPointRef.current;
      let hands = analyzedHandsRef.current;
      let primaryHand = hands[0] || null;

      const frameNow = performance.now();
      if (
        landmarker &&
        video.readyState >= 2 &&
        video.currentTime !== lastVideoTimeRef.current &&
        frameNow - lastTrackingAtRef.current > TRACKING_INTERVAL_MS
      ) {
        lastVideoTimeRef.current = video.currentTime;
        lastTrackingAtRef.current = frameNow;
        const result = landmarker.detectForVideo(video, frameNow);
        hands = (result.landmarks || [])
          .map((landmarks, index) => {
            const category = result.handednesses?.[index]?.[0];
            return analyzeHand(landmarks, width, height, category?.categoryName || category?.displayName || 'Unknown');
          })
          .filter(Boolean);
        analyzedHandsRef.current = hands;
        const twoHandGesture = getTwoHandGesture(hands);
        primaryHand = hands[0] || null;
        activeGesture = twoHandGesture || primaryHand?.gesture || 'none';

        if (primaryHand) {
          const rawPoint = primaryHand.center;
          const previous = smoothedPointRef.current || rawPoint;
          canvasPoint = {
            x: previous.x * 0.72 + rawPoint.x * 0.28,
            y: previous.y * 0.72 + rawPoint.y * 0.28,
          };
          smoothedPointRef.current = canvasPoint;
        } else {
          if (ofudaReadyRef.current.active) {
            spawnFailedOfuda(talismansRef.current, floatingTextsRef.current, smoothedPointRef.current || { x: width * 0.5, y: height * 0.5 }, 1);
            ofudaReadyRef.current = { active: false, armed: false, at: 0, fistAt: 0, handLabel: null };
          }
          canvasPoint = null;
          smoothedPointRef.current = null;
        }
      }

      drawAtmosphere(ctx, width, height, activeGesture);
      const fireExclusive = activeGesture === 'fireCharge' || fireChargeRef.current.active;
      if (fireExclusive) {
        circleTrailRef.current = [];
        ofudaReadyRef.current = { active: false, armed: false, at: 0, fistAt: 0, handLabel: null };
      }

      if (canvasPoint && primaryHand && !fireExclusive) {
        const now = performance.now();
        const ready = ofudaReadyRef.current;
        const motion = handMotionRef.current;
        const circleHand =
          hands.length === 1 && activeGesture !== 'fireCharge'
            ? hands.find((hand) => hand.openHandLike && !hand.fingerGun && !hand.fistOfuda)
            : null;
        if (circleHand) {
          updateCircleTrail(circleTrailRef.current, circleHand.center, now);
        } else {
          circleTrailRef.current = [];
        }
        const circleActive = !!circleHand && detectCircleGesture(circleTrailRef.current);
        const ofudaPoint = circleHand?.center || primaryHand.center || canvasPoint;

        if (!ready.active && circleActive) {
          ofudaReadyRef.current = {
            active: true,
            armed: false,
            at: now,
            fistAt: 0,
            handLabel: circleHand?.handLabel || null,
          };
          circleTrailRef.current = [];
          activeGesture = 'circleOfuda';
        } else if (ready.active) {
          const holder = ready.handLabel ? hands.find((hand) => hand.handLabel === ready.handLabel) : primaryHand;
          const heldPoint = holder?.center || ofudaPoint;
          drawSpiritVision(ctx, width, height, heldPoint);
          drawHeldOfuda(ctx, heldPoint, ready.armed);
          activeGesture = 'circleOfuda';

          if (holder?.fistOfuda) {
            if (!ready.fistAt) ready.fistAt = now;
            if (now - ready.fistAt > 220) ready.armed = true;
          } else {
            ready.fistAt = 0;
          }

          if (ready.armed && holder?.openHandLike && !holder.fingerGun && now - motion.lastOfudaThrow > 750) {
            const releaseDirection = normalizeVector(holder.middleTip.x - holder.wrist.x, holder.middleTip.y - holder.wrist.y);
            spawnOfudaThrow(talismansRef.current, heldPoint, 1, releaseDirection);
            spawnImpact(impactsRef.current, {
              x: heldPoint.x + releaseDirection.x * 130,
              y: heldPoint.y + releaseDirection.y * 130,
            }, '#ffe6a6', 1.3);
            activeGesture = 'ofudaStrike';
            motion.lastOfudaThrow = now;
            ofudaReadyRef.current = { active: false, armed: false, at: 0, fistAt: 0, handLabel: null };
          }
        }
      }

      if (!ofudaReadyRef.current.active) {
        if (hands.length > 1) {
          drawTwoHandLinks(ctx, hands, activeGesture);
        }

        const fireCenter = hands.length > 1 ? midpoint(hands[0].center, hands[1].center) : null;
        if (activeGesture === 'fireCharge' && fireCenter) {
          fireChargeRef.current.active = true;
          fireChargeRef.current.center = fireCenter;
          fireChargeRef.current.radius = Math.min(150, fireChargeRef.current.radius + 2.4);
          drawFireCharge(ctx, fireCenter, fireChargeRef.current.radius);
          spawnFireParticles(particlesRef.current, fireCenter);
        } else if (fireChargeRef.current.active) {
          const charge = fireChargeRef.current;
          const now = performance.now();
          if (charge.center && charge.radius > 42 && now - charge.lastLaunch > 550) {
            spawnFireball(projectilesRef.current, charge.center, charge.radius);
            spawnImpact(impactsRef.current, charge.center, '#ff8a35', 0.8);
            activeGesture = 'fireLaunch';
            charge.lastLaunch = now;
          }
          fireChargeRef.current = { ...charge, active: false, center: null, radius: 0 };
        }

      }

      if (canvasPoint && primaryHand && !ofudaReadyRef.current.active && !fireExclusive) {
        const now = performance.now();
        const motion = handMotionRef.current;
        const gunHand = hands.find((hand) => hand.fingerGun);
        if (gunHand && now > motion.fingerGunBlockedUntil) {
          const bulletOrigin = midpoint(gunHand.indexTip, gunHand.center);
          const bulletDirection = { x: 0, y: -1 };
          drawFingerGunSight(ctx, bulletOrigin, bulletDirection, true);
          if (now - handMotionRef.current.lastBullet > 230) {
            spawnBullet(projectilesRef.current, bulletOrigin, bulletDirection);
            handMotionRef.current.lastBullet = now;
          }
        }
        if (activeGesture !== 'fireCharge') {
          drawHandSigil(ctx, canvasPoint, activeGesture);
          if (activeGesture !== 'circleOfuda' && activeGesture !== 'openPalm') drawSealScript(ctx, canvasPoint, activeGesture);
        }
        spawnParticles(particlesRef.current, canvasPoint, activeGesture);
        handMotionRef.current.scale = primaryHand.scale;
        handMotionRef.current.point = canvasPoint;
        handMotionRef.current.at = performance.now();
      }

      updateParticles(ctx, particlesRef.current, width, height);
      updateTalismans(ctx, talismansRef.current, width, height);
      updateBeams(ctx, beamsRef.current);
      updateProjectiles(ctx, projectilesRef.current, impactsRef.current, width, height);
      updateImpacts(ctx, impactsRef.current);
      updateFloatingTexts(ctx, floatingTextsRef.current);
      updateHudState(uiStateRef, gestureRef, setGesture, setHandPoint, activeGesture, canvasPoint, dpr);
      soundEngine.playGesture(activeGesture);

      rafId = requestAnimationFrame(render);
      animationRef.current = rafId;
    };

    rafId = requestAnimationFrame(render);
    animationRef.current = rafId;
    return () => cancelAnimationFrame(rafId);
  }, [soundEngine]);

  const gestureMeta = GESTURES[gesture] || GESTURES.none;

  return (
    <main className={`stage ${gesture}`}>
      <div className="city-backdrop" />
      <div className="rain-veil" />
      <div className="ward-grid" />
      <canvas ref={canvasRef} className="fx-canvas" aria-hidden="true" />

      <section className="hud">
        <div className="brand-block">
          <div className="brand-mark">
            <Aperture size={24} />
          </div>
          <div>
            <p className="eyebrow">Realtime Hand Seal Prototype</p>
            <h1>Tokyo Spirit Gesture</h1>
          </div>
        </div>

        <div className="status-strip">
          <span className="pulse-dot" />
          <span>{status}</span>
        </div>
      </section>

      <aside className="control-panel">
        <div className="panel-section primary-readout">
          <p className="panel-label">
            <Hand size={16} />
            Current Gesture
          </p>
          <strong style={{ color: gestureMeta.tone }}>{gestureMeta.label}</strong>
          <span>{gestureMeta.hint}</span>
        </div>

        <div className="panel-grid">
          <div>
            <p className="panel-label">
              <Sparkles size={15} />
              Active Mode
            </p>
            <strong>{gestureMeta.mode}</strong>
          </div>
          <div>
            <p className="panel-label">
              <Activity size={15} />
              Hand Lock
            </p>
            <strong>{handPoint ? `${handPoint.x}, ${handPoint.y}` : 'No target'}</strong>
          </div>
        </div>

        <button className="sound-toggle" onClick={() => setIsSoundOn((value) => !value)} type="button">
          <Volume2 size={18} />
          {isSoundOn ? 'Sound On' : 'Sound Off'}
        </button>
      </aside>

      <div className="gesture-legend">
        <GestureChip active={gesture === 'circleOfuda' || gesture === 'ofudaStrike'} icon={<Sparkles size={18} />} label="Circle Ofuda" />
        <GestureChip active={gesture === 'fireCharge' || gesture === 'fireLaunch'} icon={<Zap size={18} />} label="Two-Hand Fire" />
        <GestureChip active={gesture === 'pointing'} icon={<Activity size={18} />} label="Finger Gun" />
      </div>

      <div className="camera-preview">
        <div className="camera-header">
          <Camera size={15} />
          <span>Webcam</span>
        </div>
        {!permissionRequested && (
          <div className="loading-camera">
            <LoaderCircle size={22} />
          </div>
        )}
        <video ref={videoRef} playsInline muted />
      </div>
    </main>
  );
}

function GestureChip({ active, icon, label }) {
  return (
    <div className={`gesture-chip ${active ? 'active' : ''}`}>
      {icon}
      <span>{label}</span>
    </div>
  );
}

function drawAtmosphere(ctx, width, height, gesture) {
  const time = performance.now() * 0.001;
  const gradient = ctx.createRadialGradient(width * 0.52, height * 0.48, 0, width * 0.52, height * 0.5, width * 0.74);
  gradient.addColorStop(0, gesture === 'circleOfuda' ? 'rgba(70, 130, 255, 0.26)' : 'rgba(75, 31, 120, 0.2)');
  gradient.addColorStop(0.55, 'rgba(10, 26, 55, 0.08)');
  gradient.addColorStop(1, 'rgba(1, 3, 12, 0.02)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.globalAlpha = 0.2;
  ctx.strokeStyle = 'rgba(110, 240, 255, 0.42)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 18; i += 1) {
    const x = ((i * 193 + time * 28) % width) - 40;
    ctx.beginPath();
    ctx.moveTo(x, height * 0.22);
    ctx.lineTo(x + Math.sin(time + i) * 26, height);
    ctx.stroke();
  }
  ctx.restore();
}

function drawSpiritVision(ctx, width, height, point) {
  ctx.save();
  const radius = 190 + Math.sin(performance.now() * 0.005) * 18;
  const glow = ctx.createRadialGradient(point.x, point.y, 20, point.x, point.y, radius);
  glow.addColorStop(0, 'rgba(139, 216, 255, 0.36)');
  glow.addColorStop(0.45, 'rgba(139, 91, 255, 0.14)');
  glow.addColorStop(1, 'rgba(29, 10, 55, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);
  ctx.globalCompositeOperation = 'screen';
  ctx.strokeStyle = 'rgba(129, 246, 255, 0.4)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(point.x, point.y, radius * 0.44, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawChargingOrb(ctx, point) {
  const time = performance.now() * 0.006;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 4; i += 1) {
    ctx.strokeStyle = i % 2 ? 'rgba(195, 125, 255, 0.72)' : 'rgba(91, 246, 255, 0.68)';
    ctx.lineWidth = 2.5 - i * 0.35;
    ctx.beginPath();
    ctx.ellipse(point.x, point.y, 52 + i * 12, 22 + i * 8, time + i * 0.8, 0, Math.PI * 2);
    ctx.stroke();
  }

  const orb = ctx.createRadialGradient(point.x, point.y, 3, point.x, point.y, 82);
  orb.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
  orb.addColorStop(0.18, 'rgba(149, 248, 255, 0.72)');
  orb.addColorStop(0.52, 'rgba(164, 90, 255, 0.26)');
  orb.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = orb;
  ctx.beginPath();
  ctx.arc(point.x, point.y, 82, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawHandSigil(ctx, point, gesture) {
  const tone = GESTURES[gesture]?.tone || '#77f6ff';
  const time = performance.now() * 0.004;
  ctx.save();
  ctx.translate(point.x, point.y);
  ctx.rotate(time);
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = tone;
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.75;

  for (let ring = 0; ring < 3; ring += 1) {
    ctx.beginPath();
    ctx.arc(0, 0, 34 + ring * 24 + Math.sin(time * 2 + ring) * 3, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.beginPath();
  for (let i = 0; i < 6; i += 1) {
    const angle = (Math.PI * 2 * i) / 6;
    const x = Math.cos(angle) * 44;
    const y = Math.sin(angle) * 44;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, 18, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawSealScript(ctx, point, gesture) {
  if (gesture === 'none') return;
  const time = performance.now() * 0.003;
  const tone = GESTURES[gesture]?.tone || '#77f6ff';

  ctx.save();
  ctx.translate(point.x, point.y);
  ctx.globalCompositeOperation = 'lighter';
  ctx.font = '700 22px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = tone;
  ctx.shadowBlur = 8;
  ctx.shadowColor = tone;

  for (let i = 0; i < OFUDA_MARKS.length; i += 1) {
    const angle = time + (Math.PI * 2 * i) / OFUDA_MARKS.length;
    const radius = 126;
    ctx.globalAlpha = 0.28 + Math.sin(time * 5 + i) * 0.08;
    ctx.save();
    ctx.translate(Math.cos(angle) * radius, Math.sin(angle) * radius);
    ctx.rotate(angle + Math.PI / 2);
    ctx.fillText(OFUDA_MARKS[i], 0, 0);
    ctx.restore();
  }
  ctx.restore();
}

function midpoint(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function drawTwoHandLinks(ctx, hands, gesture) {
  const [a, b] = hands;
  const center = midpoint(a.center, b.center);
  const tone = gesture === 'fireCharge' ? '#ff9f43' : '#6fefff';

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = tone;
  ctx.shadowColor = tone;
  ctx.shadowBlur = 8;
  ctx.globalAlpha = gesture === 'fireCharge' ? 0.72 : 0.24;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(a.indexTip.x, a.indexTip.y);
  ctx.quadraticCurveTo(center.x, center.y - 40, b.indexTip.x, b.indexTip.y);
  ctx.moveTo(a.thumbTip.x, a.thumbTip.y);
  ctx.quadraticCurveTo(center.x, center.y + 40, b.thumbTip.x, b.thumbTip.y);
  ctx.stroke();
  ctx.restore();
}

function drawOfudaHalo(ctx, point, count = 4) {
  const time = performance.now() * 0.0038;
  const total = Math.max(1, count);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < total; i += 1) {
    const angle = time + (Math.PI * 2 * i) / total;
    const x = point.x + Math.cos(angle) * 118;
    const y = point.y + Math.sin(angle) * 72;
    drawOfuda(ctx, x, y, angle + Math.PI / 2, 0.62, 0.56, OFUDA_MARKS[i % OFUDA_MARKS.length], '#ffe6a6');
  }
  ctx.restore();
}

function drawHeldOfuda(ctx, point, armed = false) {
  const time = performance.now() * 0.004;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = armed ? 'rgba(255, 230, 166, 0.9)' : 'rgba(139, 216, 255, 0.68)';
  ctx.shadowColor = armed ? '#ffe6a6' : '#8bd8ff';
  ctx.shadowBlur = armed ? 26 : 16;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(point.x, point.y, armed ? 92 + Math.sin(time * 3) * 8 : 78, 0, Math.PI * 2);
  ctx.stroke();
  drawOfuda(ctx, point.x, point.y - 8, Math.sin(time) * 0.08, armed ? 1.45 : 1.28, 0.92, armed ? '破' : '封', armed ? '#ffe6a6' : '#8bd8ff');
  ctx.restore();
}

function drawFireCharge(ctx, point, radius) {
  const time = performance.now() * 0.006;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  const glow = ctx.createRadialGradient(point.x, point.y, 4, point.x, point.y, radius * 1.45);
  glow.addColorStop(0, 'rgba(255, 255, 245, 0.96)');
  glow.addColorStop(0.18, 'rgba(255, 188, 71, 0.82)');
  glow.addColorStop(0.48, 'rgba(255, 76, 32, 0.42)');
  glow.addColorStop(1, 'rgba(103, 24, 0, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(point.x, point.y, radius * 1.45, 0, Math.PI * 2);
  ctx.fill();

  for (let i = 0; i < 5; i += 1) {
    ctx.strokeStyle = i % 2 ? 'rgba(255, 228, 130, 0.72)' : 'rgba(255, 92, 38, 0.82)';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.ellipse(point.x, point.y, radius + i * 8, radius * 0.42 + i * 4, time + i * 0.75, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawFingerGunSight(ctx, point, direction, frontFacing = false) {
  const time = performance.now() * 0.006;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = '#57ff8a';
  ctx.shadowColor = '#57ff8a';
  ctx.shadowBlur = 8;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(point.x, point.y, 18, 0, Math.PI * 2);
  ctx.arc(point.x, point.y, 32 + Math.sin(time) * 4, 0, Math.PI * 2);
  ctx.stroke();
  if (frontFacing) {
    ctx.fillStyle = 'rgba(87, 255, 138, 0.22)';
    ctx.beginPath();
    ctx.arc(point.x, point.y, 46 + Math.sin(time * 1.7) * 10, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
    ctx.lineTo(point.x + direction.x * 86, point.y + direction.y * 86);
    ctx.stroke();
  }
  ctx.restore();
}

function spawnParticles(particles, point, gesture) {
  const amount = gesture === 'fireCharge' ? 2 : gesture === 'circleOfuda' ? 2 : 1;
  const palette =
    gesture === 'fireCharge' || gesture === 'fireLaunch'
      ? ['#ffef9d', '#ff9f43', '#ff4c2e']
      : gesture === 'pointing'
            ? ['#57ff8a', '#b9ffd0', '#53d7ff']
            : ['#6fefff', '#8b5bff', '#d9fbff'];
  for (let i = 0; i < amount; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.7 + Math.random() * 3.2;
    particles.push({
      x: point.x + (Math.random() - 0.5) * 44,
      y: point.y + (Math.random() - 0.5) * 44,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 0.35,
      life: 40 + Math.random() * 34,
      maxLife: 74,
      size: 1.2 + Math.random() * 3.6,
      color: palette[Math.floor(Math.random() * palette.length)],
    });
  }
  if (particles.length > 120) particles.splice(0, particles.length - 120);
}

function spawnFireParticles(particles, point) {
  for (let i = 0; i < 2; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 18 + Math.random() * 86;
    particles.push({
      x: point.x + Math.cos(angle) * radius,
      y: point.y + Math.sin(angle) * radius,
      vx: -Math.cos(angle) * (0.6 + Math.random() * 1.8),
      vy: -Math.sin(angle) * (0.6 + Math.random() * 1.8),
      life: 28 + Math.random() * 24,
      maxLife: 56,
      size: 2 + Math.random() * 6,
      color: ['#ffef9d', '#ff9f43', '#ff4c2e'][Math.floor(Math.random() * 3)],
    });
  }
  if (particles.length > 140) particles.splice(0, particles.length - 140);
}

function updateParticles(ctx, particles, width, height) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const particle = particles[i];
    particle.x += particle.vx;
    particle.y += particle.vy;
    particle.vx *= 0.985;
    particle.vy *= 0.985;
    particle.life -= 1;

    if (particle.life <= 0 || particle.x < -50 || particle.x > width + 50 || particle.y < -50 || particle.y > height + 50) {
      particles.splice(i, 1);
      continue;
    }

    const alpha = Math.max(0, particle.life / particle.maxLife);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = particle.color;
    ctx.shadowBlur = 8;
    ctx.shadowColor = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.size * alpha, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function spawnTalismans(talismans, point, gesture, direction = null) {
  const now = performance.now();
  const last = talismans[talismans.length - 1];
  const delay = gesture === 'pointing' ? 95 : 170;
  if (last && now - last.createdAt < delay) return;

  const amount = 1;
  for (let i = 0; i < amount; i += 1) {
    const angle = direction
      ? Math.atan2(direction.y, direction.x) + (Math.random() - 0.5) * 0.38
      : Math.random() * Math.PI * 2;
    const speed = gesture === 'pointing' ? 10 + Math.random() * 6 : 1.2 + Math.random() * 3.2;
    const orbit = gesture !== 'pointing' && Math.random() > 0.42;

    talismans.push({
      x: point.x + (Math.random() - 0.5) * 52,
      y: point.y + (Math.random() - 0.5) * 52,
      originX: point.x,
      originY: point.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - (gesture === 'circleOfuda' ? 1.2 : 0),
      rotation: angle + Math.PI / 2,
      spin: (Math.random() - 0.5) * 0.16,
      scale: 0.72 + Math.random() * 0.42,
      life: gesture === 'pointing' ? 38 : 76 + Math.random() * 34,
      maxLife: gesture === 'pointing' ? 38 : 110,
      mark: OFUDA_MARKS[Math.floor(Math.random() * OFUDA_MARKS.length)],
      color: gesture === 'pointing' ? '#5ff7e8' : '#8bd8ff',
      orbit,
      orbitAngle: Math.random() * Math.PI * 2,
      orbitRadius: 92 + Math.random() * 58,
      createdAt: now,
    });
  }

  if (talismans.length > 28) talismans.splice(0, talismans.length - 28);
}

function spawnOfudaThrow(talismans, point, count = 4, direction = { x: 0, y: -1 }) {
  const amount = Math.max(1, Math.min(6, count));
  const baseAngle = Math.atan2(direction.y, direction.x);

  for (let i = 0; i < amount; i += 1) {
    const angle = baseAngle + (Math.random() - 0.5) * 0.62;
    const speed = 14 + Math.random() * 11;
    talismans.push({
      x: point.x + (Math.random() - 0.5) * 80,
      y: point.y + (Math.random() - 0.5) * 60,
      originX: point.x,
      originY: point.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      rotation: angle + Math.PI / 2,
      spin: (Math.random() - 0.5) * 0.38,
      scale: 0.72 + Math.random() * 0.56,
      life: 48 + Math.random() * 24,
      maxLife: 72,
      mark: OFUDA_MARKS[Math.floor(Math.random() * OFUDA_MARKS.length)],
      color: '#ffe6a6',
      orbit: false,
      orbitAngle: 0,
      orbitRadius: 0,
      createdAt: performance.now(),
    });
  }
  if (talismans.length > 34) talismans.splice(0, talismans.length - 34);
}

function spawnFailedOfuda(talismans, floatingTexts, point, count = 1) {
  const amount = Math.max(1, Math.min(6, count));
  for (let i = 0; i < amount; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 2 + Math.random() * 4;
    talismans.push({
      x: point.x + (Math.random() - 0.5) * 58,
      y: point.y + (Math.random() - 0.5) * 58,
      originX: point.x,
      originY: point.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 1.5,
      rotation: angle + Math.PI / 2,
      spin: (Math.random() - 0.5) * 0.32,
      scale: 0.58 + Math.random() * 0.26,
      life: 32 + Math.random() * 18,
      maxLife: 50,
      mark: OFUDA_MARKS[Math.floor(Math.random() * OFUDA_MARKS.length)],
      color: '#ff6b8a',
      orbit: false,
      orbitAngle: 0,
      orbitRadius: 0,
      createdAt: performance.now(),
    });
  }

  floatingTexts.push({
    x: point.x,
    y: point.y - 42,
    text: '発射失敗',
    subtext: '发射失败',
    color: '#ff6b8a',
    life: 70,
    maxLife: 70,
  });
}

function updateTalismans(ctx, talismans, width, height) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = talismans.length - 1; i >= 0; i -= 1) {
    const talisman = talismans[i];
    talisman.life -= 1;
    if (
      talisman.life <= 0 ||
      talisman.x < -120 ||
      talisman.x > width + 120 ||
      talisman.y < -120 ||
      talisman.y > height + 120
    ) {
      talismans.splice(i, 1);
      continue;
    }

    if (talisman.orbit) {
      talisman.orbitAngle += 0.045;
      talisman.originX += (talisman.vx * 0.16);
      talisman.originY += (talisman.vy * 0.16);
      talisman.x = talisman.originX + Math.cos(talisman.orbitAngle) * talisman.orbitRadius;
      talisman.y = talisman.originY + Math.sin(talisman.orbitAngle) * talisman.orbitRadius * 0.62;
      talisman.rotation = talisman.orbitAngle + Math.PI / 2;
    } else {
      talisman.x += talisman.vx;
      talisman.y += talisman.vy;
      talisman.vx *= 0.985;
      talisman.vy *= 0.985;
      talisman.rotation += talisman.spin;
    }

    const alpha = Math.max(0, talisman.life / talisman.maxLife);
    drawOfuda(ctx, talisman.x, talisman.y, talisman.rotation, talisman.scale, alpha * 0.9, talisman.mark, talisman.color);
  }
  ctx.restore();
}

function drawOfuda(ctx, x, y, rotation, scale, alpha, mark, glowColor) {
  const w = 30 * scale;
  const h = 72 * scale;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.globalAlpha = alpha;
  ctx.shadowBlur = 9 * scale;
  ctx.shadowColor = glowColor;

  ctx.fillStyle = 'rgba(255, 245, 214, 0.92)';
  ctx.strokeStyle = glowColor;
  ctx.lineWidth = 1.2 * scale;
  ctx.beginPath();
  ctx.moveTo(-w / 2, -h / 2 + 3 * scale);
  ctx.lineTo(w / 2, -h / 2 + 3 * scale);
  ctx.lineTo(w / 2, h / 2 - 3 * scale);
  ctx.lineTo(-w / 2, h / 2 - 3 * scale);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = 'rgba(27, 22, 34, 0.72)';
  ctx.fillRect(-w * 0.33, -h * 0.34, w * 0.66, h * 0.08);
  ctx.fillRect(-w * 0.24, h * 0.2, w * 0.48, h * 0.06);

  ctx.fillStyle = 'rgba(142, 20, 48, 0.9)';
  ctx.font = `${Math.max(14, 24 * scale)}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(mark, 0, -h * 0.02);

  ctx.strokeStyle = 'rgba(142, 20, 48, 0.78)';
  ctx.lineWidth = 1 * scale;
  ctx.beginPath();
  ctx.moveTo(-w * 0.22, -h * 0.18);
  ctx.lineTo(w * 0.22, -h * 0.18);
  ctx.moveTo(-w * 0.18, h * 0.11);
  ctx.lineTo(w * 0.18, h * 0.11);
  ctx.stroke();
  ctx.restore();
}

function spawnBeam(beams, point, direction) {
  const now = performance.now();
  const lastBeam = beams[beams.length - 1];
  if (lastBeam && now - lastBeam.createdAt < 140) return;
  const length = Math.hypot(direction.x, direction.y) || 1;
  const unit = { x: direction.x / length, y: direction.y / length };
  beams.push({
    x: point.x,
    y: point.y,
    dx: unit.x,
    dy: unit.y,
    life: 18,
    createdAt: now,
  });
  if (beams.length > 12) beams.shift();
}

function spawnFireball(projectiles, point, radius) {
  projectiles.push({
    type: 'fireball',
    x: point.x,
    y: point.y,
    vx: 0,
    vy: -18,
    radius: Math.max(44, radius),
    life: 80,
    maxLife: 80,
    color: '#ff7a35',
  });
}

function spawnBullet(projectiles, point, direction) {
  projectiles.push({
    type: 'bullet',
    x: point.x,
    y: point.y,
    vx: direction.x * 24,
    vy: direction.y * 24,
    radius: 8,
    life: 48,
    maxLife: 48,
    color: '#57ff8a',
  });
  if (projectiles.length > 36) projectiles.splice(0, projectiles.length - 36);
}

function updateProjectiles(ctx, projectiles, impacts, width, height) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = projectiles.length - 1; i >= 0; i -= 1) {
    const shot = projectiles[i];
    shot.x += shot.vx;
    shot.y += shot.vy;
    shot.life -= 1;

    const alpha = Math.max(0, shot.life / shot.maxLife);
    if (shot.life <= 0 || shot.x < -180 || shot.x > width + 180 || shot.y < -180 || shot.y > height + 180) {
      spawnImpact(impacts, { x: shot.x, y: Math.max(60, Math.min(height - 60, shot.y)) }, shot.color, shot.type === 'fireball' ? 1.8 : 0.7);
      projectiles.splice(i, 1);
      continue;
    }

    if (shot.type === 'fireball') {
      const glow = ctx.createRadialGradient(shot.x, shot.y, 4, shot.x, shot.y, shot.radius * 1.6);
      glow.addColorStop(0, `rgba(255,255,245,${0.95 * alpha})`);
      glow.addColorStop(0.2, `rgba(255,169,66,${0.85 * alpha})`);
      glow.addColorStop(0.58, `rgba(255,64,24,${0.38 * alpha})`);
      glow.addColorStop(1, 'rgba(255,64,24,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(shot.x, shot.y, shot.radius * 1.6, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.shadowColor = shot.color;
      ctx.shadowBlur = 12;
      ctx.fillStyle = `rgba(87,255,138,${alpha})`;
      ctx.beginPath();
      ctx.arc(shot.x, shot.y, shot.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(185,255,208,${0.9 * alpha})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(shot.x - shot.vx * 1.7, shot.y - shot.vy * 1.7);
      ctx.lineTo(shot.x, shot.y);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function spawnImpact(impacts, point, color, scale = 1) {
  impacts.push({
    x: point.x,
    y: point.y,
    radius: 12,
    maxRadius: 96 * scale,
    color,
    life: 26,
    maxLife: 26,
  });
  if (impacts.length > 30) impacts.shift();
}

function updateImpacts(ctx, impacts) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = impacts.length - 1; i >= 0; i -= 1) {
    const impact = impacts[i];
    impact.life -= 1;
    impact.radius += (impact.maxRadius - impact.radius) * 0.24;
    if (impact.life <= 0) {
      impacts.splice(i, 1);
      continue;
    }
    const alpha = impact.life / impact.maxLife;
    ctx.strokeStyle = impact.color;
    ctx.globalAlpha = alpha;
    ctx.shadowColor = impact.color;
    ctx.shadowBlur = 12;
    ctx.lineWidth = 5 * alpha;
    ctx.beginPath();
    ctx.arc(impact.x, impact.y, impact.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 1.4 * alpha;
    for (let ray = 0; ray < 6; ray += 1) {
      const angle = (Math.PI * 2 * ray) / 6;
      ctx.beginPath();
      ctx.moveTo(impact.x + Math.cos(angle) * impact.radius * 0.55, impact.y + Math.sin(angle) * impact.radius * 0.55);
      ctx.lineTo(impact.x + Math.cos(angle) * impact.radius * 1.15, impact.y + Math.sin(angle) * impact.radius * 1.15);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function updateFloatingTexts(ctx, floatingTexts) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = floatingTexts.length - 1; i >= 0; i -= 1) {
    const item = floatingTexts[i];
    item.life -= 1;
    item.y -= 0.42;
    if (item.life <= 0) {
      floatingTexts.splice(i, 1);
      continue;
    }

    const alpha = item.life / item.maxLife;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = item.color;
    ctx.shadowColor = item.color;
    ctx.shadowBlur = 16;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 30px serif';
    ctx.fillText(item.text, item.x, item.y);
    ctx.font = '600 14px sans-serif';
    ctx.fillText(item.subtext, item.x, item.y + 30);
  }
  ctx.restore();
}

function updateBeams(ctx, beams) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = beams.length - 1; i >= 0; i -= 1) {
    const beam = beams[i];
    beam.life -= 1;
    if (beam.life <= 0) {
      beams.splice(i, 1);
      continue;
    }
    const alpha = beam.life / 18;
    const endX = beam.x + beam.dx * 960;
    const endY = beam.y + beam.dy * 960;
    const gradient = ctx.createLinearGradient(beam.x, beam.y, endX, endY);
    gradient.addColorStop(0, `rgba(255, 255, 255, ${0.85 * alpha})`);
    gradient.addColorStop(0.12, `rgba(91, 247, 232, ${0.78 * alpha})`);
    gradient.addColorStop(1, 'rgba(91, 247, 232, 0)');
    ctx.strokeStyle = gradient;
    ctx.lineCap = 'round';
    ctx.shadowColor = '#5ff7e8';
    ctx.shadowBlur = 24;
    ctx.lineWidth = 9 * alpha;
    ctx.beginPath();
    ctx.moveTo(beam.x, beam.y);
    ctx.lineTo(endX, endY);
    ctx.stroke();
    ctx.lineWidth = 2.2 * alpha;
    ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.beginPath();
    ctx.moveTo(beam.x, beam.y);
    ctx.lineTo(endX, endY);
    ctx.stroke();
  }
  ctx.restore();
}

createRoot(document.getElementById('root')).render(<App />);
