export const fieldVertex = `
attribute float diameter; attribute float strength; attribute vec3 tint;
uniform float focal; uniform float dust; uniform vec3 localEye;
varying vec3 rgb; varying float intensity;
void main(){
  vec4 v=modelViewMatrix*vec4(position,1.);
  float size=diameter*focal/max(.03,-v.z);
  gl_Position=projectionMatrix*v;
  gl_PointSize=clamp(size,1.,120.);
  rgb=tint; intensity=strength*min(1.,size*size);
  if(dust>0. && position.y*localEye.y<0.){
    vec3 ray=localEye-position;
    float t=-position.y/ray.y;
    float r=length((position+t*ray).xz);
    float lane=smoothstep(2.3,5.,r)*(1.-smoothstep(10.5,13.8,r));
    intensity*=exp(-dust*lane/(.07+abs(normalize(ray).y)));
  }
}`
export const fieldFragment = `
varying vec3 rgb; varying float intensity;
void main(){
  vec2 p=2.*gl_PointCoord-1.; float r=dot(p,p);
  if(r>=1.)discard;
  gl_FragColor=vec4(rgb,intensity*exp(-3.7*r)*(1.-smoothstep(.65,1.,r)));
}`
export const volumeVertex = `varying vec3 localPoint;
void main(){localPoint=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`
export const volumeFragment = `
uniform vec3 localEye; uniform sampler2D skyMap; uniform vec4 profile; uniform float kind;
varying vec3 localPoint;
vec3 sky(vec3 p){return vec3(p.x,profile.y*p.y-profile.x*p.z,profile.x*p.y+profile.y*p.z);}
vec2 depthProfile(vec3 q){
  float h=profile.z+profile.w*exp(-q.x*q.x/17.-q.y*q.y/12.);
  if(profile.x<.28 && kind!=3.)h+=2.7*smoothstep(.9,3.8,abs(q.y));
  if(kind==1.){vec2 s=q.xy-vec2(11.7,3.1);h+=1.25*exp(-dot(s,s)/6.);}
  if(kind==3.)h+=2.15*min(1.,abs(q.y)/4.);
  float z=kind==4.?4.:kind==3.?3.9:kind==2.?5.75:kind==1.?5.9:5.8;
  float varV=h*h*profile.y*profile.y+z*z*profile.x*profile.x;
  float mean=q.y*profile.x*profile.y*(h*h-z*z)/varV;
  float sigma=h*z*inversesqrt(varV);
  return vec2((q.z-mean)/sigma,sigma);
}
float cdf(float q){return 1./(1.+exp(-clamp(1.70*q,-16.,16.)));}
void main(){
  vec3 ray=normalize(localPoint-localEye);
  vec3 invDir=sign(ray+vec3(.000001))/max(abs(ray),vec3(.000001));
  vec3 halfBox=vec3(16.05,13.,21.);
  vec3 a=(-halfBox-localEye)*invDir,b=(halfBox-localEye)*invDir;
  vec3 nearT=min(a,b),farT=max(a,b);
  float start=max(0.,max(nearT.x,max(nearT.y,nearT.z))),end=min(farT.x,min(farT.y,farT.z));
  if(end<=start)discard;
  float ds=(end-start)/48.;
  vec3 point=localEye+ray*start,q=sky(point),dq=sky(ray)*ds,sum=vec3(0.);
  vec2 previous=depthProfile(q);
  for(int i=0;i<48;i++){
    vec3 next=q+dq;vec2 current=depthProfile(next);
    if(min(abs(previous.x),abs(current.x))<4.5 || previous.x*current.x<=0.){
      float diff=current.x-previous.x,mid=.5*(current.x+previous.x);
      float mass=abs(diff)>.015?(cdf(current.x)-cdf(previous.x))/diff:.39894*exp(-.5*mid*mid);
      float f=previous.x*current.x<0.?clamp(-previous.x/diff,.02,.98):.5;
      vec2 uv=vec2(.5)+mix(q.xy,next.xy,f)/vec2(32.,24.);
      if(all(greaterThan(uv,vec2(0.)))&&all(lessThan(uv,vec2(1.)))){
        vec3 light=texture2D(skyMap,uv).rgb;
        float weight=max(0.,mass)*ds/max(.06,.5*(current.y+previous.y));
        weight*=1.-smoothstep(12.6,16.4,length(point.xz));
        if(kind==2. && point.y*localEye.y<0.){
          float r=length(point.xz);weight*=1.-.59*smoothstep(3.,6.,r)*(1.-smoothstep(10.,14.,r));
        }
        sum+=(-log(max(vec3(.012),1.-light)))*weight;
      }
    }
    previous=current;q=next;point+=ray*ds;
  }
  float exposure=pow(clamp((abs(normalize(localEye).y)+.14)/(profile.x+.14),.14,1.12),.65);
  gl_FragColor=vec4(1.-exp(-sum*exposure),1.);
}`
export const normalVertex = `
varying vec2 tex; varying vec3 nrm; varying vec3 wp;
void main(){tex=uv;nrm=normalize(mat3(modelMatrix)*normal);vec4 w=modelMatrix*vec4(position,1.);wp=w.xyz;
gl_Position=projectionMatrix*viewMatrix*w;}`
export const starFragment = `
uniform sampler2D photo;uniform vec3 cold;uniform vec3 hot;
varying vec2 tex;varying vec3 nrm;varying vec3 wp;
void main(){
  float n=texture2D(photo,tex).r;
  float f=smoothstep(.20,.99,n);
  float mu=max(0.,dot(normalize(nrm),normalize(cameraPosition-wp)));
  gl_FragColor=vec4(mix(cold,hot,f)*(.60+.40*sqrt(mu)),1.);
}`
export const atmosphereFragment = `
uniform vec3 tint; uniform vec3 lightPos;
varying vec2 tex;varying vec3 nrm;varying vec3 wp;
void main(){
  vec3 n=normalize(nrm);
  float rim=pow(smoothstep(.002,.25,abs(dot(n,normalize(cameraPosition-wp)))),1.7);
  float day=max(0.,dot(n,normalize(lightPos-wp)));
  gl_FragColor=vec4(tint,rim*(.015+.40*day));
}`
export const planetAtmosphereVertex = `
varying vec3 vLocalPos;
varying vec3 vLocalCam;
varying vec3 vWorldCenter;
varying vec3 vWorldPos;
void main() {
  vLocalPos = position;
  vec3 c0 = modelMatrix[0].xyz;
  vec3 c1 = modelMatrix[1].xyz;
  vec3 c2 = modelMatrix[2].xyz;
  vec3 center = modelMatrix[3].xyz;
  vec3 diff = cameraPosition - center;
  vLocalCam = vec3(
    dot(diff, c0) / max(1e-8, dot(c0, c0)),
    dot(diff, c1) / max(1e-8, dot(c1, c1)),
    dot(diff, c2) / max(1e-8, dot(c2, c2))
  );
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldCenter = center;
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`
export const planetAtmosphereFragment = `
uniform vec3 uLightPos;
uniform float uInnerRatio;
uniform vec3 uDayColor;
uniform vec3 uSunsetColor;
uniform float uFalloff;
uniform float uIntensity;
uniform float uSunsetStrength;
varying vec3 vLocalPos;
varying vec3 vLocalCam;
varying vec3 vWorldCenter;
varying vec3 vWorldPos;
void main() {
  vec3 rd = normalize(vLocalPos - vLocalCam);
  float tClosest = max(0.0, -dot(vLocalCam, rd));
  float d = length(vLocalCam + rd * tClosest);
  if (d >= 1.0) discard;
  float span = max(0.002, 1.0 - uInnerRatio);
  float h = clamp((d - uInnerRatio) / span, 0.0, 1.0);
  float chord = sqrt(max(0.0, 1.0 - d * d)) / sqrt(max(1e-5, 1.0 - uInnerRatio * uInnerRatio));
  float density = exp(-h * uFalloff) * (1.0 - smoothstep(0.72, 1.0, h)) * pow(clamp(chord, 0.0, 1.0), 0.45);
  vec3 toSun = normalize(uLightPos - vWorldCenter);
  vec3 viewDir = normalize(vWorldPos - cameraPosition);
  vec3 camOff = cameraPosition - vWorldCenter;
  vec3 limbVec = camOff + viewDir * max(0.0, -dot(camOff, viewDir));
  vec3 limbNorm = normalize(limbVec);
  float sunDot = dot(limbNorm, toSun);
  float dayFactor = smoothstep(-0.26, 0.45, sunDot);
  float twilight = exp(-pow((sunDot - 0.02) / 0.24, 2.0)) * uSunsetStrength;
  float forwardMie = pow(max(0.0, dot(viewDir, toSun)), 7.0) * smoothstep(-0.36, 0.28, sunDot);
  vec3 col = mix(uDayColor, uSunsetColor, clamp(twilight * 0.82, 0.0, 0.82));
  col += mix(uDayColor, uSunsetColor, 0.55) * forwardMie * (0.28 + 0.52 * uSunsetStrength);
  float alpha = density * (0.014 + 0.986 * dayFactor + 0.42 * forwardMie) * uIntensity;
  if (alpha < 0.001) discard;
  gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
}`

export const sunSurfaceVertex = `
varying vec2 vUv;
varying vec3 vNormalW;
varying vec3 vWorldPos;
varying vec3 vLocalDir;
void main() {
  vUv = uv;
  vLocalDir = normalize(position);
  vNormalW = normalize(mat3(modelMatrix) * normal);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`

export const sunSurfaceFragment = `
uniform sampler2D uMap;
uniform float uTime;
varying vec2 vUv;
varying vec3 vNormalW;
varying vec3 vWorldPos;
varying vec3 vLocalDir;

float sunNoise(vec3 p) {
  float a = sin(p.x * 7.3 + p.y * 5.1 + uTime * 0.16) * cos(p.z * 6.7 - p.y * 4.3 - uTime * 0.12);
  float b = sin(p.y * 14.2 - p.z * 11.8 + uTime * 0.21) * cos(p.x * 13.4 + p.z * 9.5);
  float c = sin((p.x + p.y) * 23.0 - uTime * 0.14) * cos((p.z - p.x) * 19.0 + uTime * 0.18);
  return 0.5 + 0.28 * a + 0.15 * b + 0.07 * c;
}

void main() {
  vec2 uv1 = vec2(fract(vUv.x + uTime * 0.0018), vUv.y);
  vec2 uv2 = vec2(
    fract(vUv.x - uTime * 0.0012 + 0.37),
    clamp(vUv.y + sin(vUv.x * 12.56637 + uTime * 0.11) * 0.0055, 0.008, 0.992)
  );
  vec3 s1 = texture2D(uMap, uv1).rgb;
  vec3 s2 = texture2D(uMap, uv2).rgb;
  float texEnergy = dot(s1, vec3(0.3333));

  float proc = sunNoise(vLocalDir);
  vec3 raw = texEnergy > 0.003 ? mix(s1, s2, 0.32) : mix(vec3(0.95, 0.42, 0.08), vec3(1.0, 0.92, 0.62), proc);
  float lum = dot(raw, vec3(0.299, 0.587, 0.114));
  float heat = clamp(lum * 1.1 + (proc - 0.5) * 0.14, 0.0, 1.0);

  vec3 viewDir = normalize(cameraPosition - vWorldPos);
  float mu = clamp(dot(normalize(vNormalW), viewDir), 0.0, 1.0);

  // Physical solar limb darkening blended with luminous incandescent core & soft chromosphere edge
  float limbDark = 0.56 + 0.44 * pow(mu, 0.46);
  vec3 col = mix(vec3(0.95, 0.38, 0.06), vec3(1.0, 0.80, 0.30), smoothstep(0.06, 0.60, heat));
  col = mix(col, vec3(1.0, 0.98, 0.88), smoothstep(0.52, 0.96, heat) * 0.86 + pow(mu, 1.65) * 0.32);
  col *= limbDark;

  // Soft glowing golden chromosphere veil right at the limb so the photosphere melts seamlessly into the 3D corona
  float rim = pow(1.0 - mu, 2.0);
  col = mix(col, vec3(1.0, 0.86, 0.48), rim * 0.66);
  col += vec3(1.0, 0.92, 0.66) * pow(1.0 - mu, 3.8) * 0.34;

  // Soft filmic shoulder to keep core creamy-white rather than harsh flat clipping
  col = col / (1.0 + max(vec3(0.0), col - vec3(0.88)) * 0.34);
  gl_FragColor = vec4(col, 1.0);
}`

export const sunCoronaVertex = `
varying vec3 vWorldPos;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`

export const sunCoronaFragment = `
uniform float uSunRadius;
uniform float uOuterRadius;
uniform float uTime;
varying vec3 vWorldPos;

float coronaStreamers(vec3 dir, float c1, float s1, float t) {
  vec3 p = vec3(dir.x * c1 - dir.z * s1, dir.y, dir.x * s1 + dir.z * c1);
  float w1 = sin(p.x * 4.8 + p.y * 3.9 + t * 0.12) * cos(p.z * 5.2 - p.y * 3.1 - t * 0.09);
  float w2 = sin(p.y * 8.6 - p.z * 7.2 + t * 0.16) * cos(p.x * 7.8 + p.y * 5.6);
  float w3 = sin((p.x + p.z) * 12.0 - t * 0.08) * cos((p.y - p.x) * 10.5 + t * 0.11);
  return 0.89 + 0.20 * (0.55 * w1 + 0.30 * w2 + 0.15 * w3);
}

void main() {
  vec3 O = cameraPosition;
  vec3 D = normalize(vWorldPos - O);
  float b = dot(O, D);
  float camR2 = dot(O, O);
  float R2 = uOuterRadius * uOuterRadius;
  float disc = b * b - (camR2 - R2);
  if (disc <= 0.0) discard;

  float sq = sqrt(disc);
  float t0 = max(0.0, -b - sq);
  float t1 = -b + sq;
  if (t1 <= t0) discard;

  // Terminate the volumetric ray at the opaque solar photosphere
  float sunR2 = uSunRadius * uSunRadius;
  float discSun = b * b - (camR2 - sunR2);
  if (discSun > 0.0) {
    float tSun = -b - sqrt(discSun);
    if (tSun > t0) t1 = min(t1, tSun);
  }
  if (t1 <= t0) discard;

  float camDist = sqrt(camR2);
  // Smooth forward-scattering envelope when camera is inside/near the outer corona (e.g. orbiting Mercury/Venus):
  // completely eliminates harsh sudden popping, screen-wide orange wash, and depth-slice rings on nearby planets.
  vec3 toSun = -O / max(camDist, 1e-4);
  float sunCos = dot(D, toSun);
  float nearMix = smoothstep(uOuterRadius * 1.18, uOuterRadius * 0.72, camDist);
  float anglePhase = mix(1.0, pow(smoothstep(-0.18, 0.86, sunCos), 1.8), nearMix);
  if (anglePhase <= 0.0005) discard;

  const int STEPS = 20;
  float dt = (t1 - t0) / float(STEPS);
  float dtNorm = dt / uSunRadius;
  float maxU = (uOuterRadius - uSunRadius) / uSunRadius;

  float accInner = 0.0;
  float accMid = 0.0;
  float accOuter = 0.0;
  float rotC = cos(uTime * 0.038);
  float rotS = sin(uTime * 0.038);

  for (int i = 0; i < STEPS; i++) {
    float t = t0 + (float(i) + 0.5) * dt;
    vec3 P = O + D * t;
    float r = length(P);
    float u = max(0.0, (r - uSunRadius) / uSunRadius);
    if (u >= maxU) continue;

    float edgeWin = 1.0 - smoothstep(0.0, maxU, u);
    edgeWin *= edgeWin;

    float streamer = coronaStreamers(P / max(r, 1e-4), rotC, rotS, uTime);
    float modS = mix(1.0, streamer, smoothstep(0.06, 0.85, u) * 0.82);

    accInner += exp(-5.2 * u) * edgeWin * dtNorm;
    accMid   += exp(-1.95 * u) * modS * edgeWin * dtNorm;
    accOuter += (1.0 / pow(1.0 + u * 1.18, 3.05)) * modS * edgeWin * dtNorm;
  }

  // Luminous golden-amber spectral radiance that stays warm & radiant over deep sapphire space (never muddy grey)
  vec3 col = vec3(1.00, 0.94, 0.72) * (accInner * 0.66)
           + vec3(1.00, 0.70, 0.24) * (accMid   * 0.24)
           + vec3(1.00, 0.48, 0.11) * (accOuter * 0.058);

  col *= anglePhase;
  // Soft filmic compression produces a silky sunlit golden falloff with zero harsh banding
  col = 1.0 - exp(-col * 1.16);

  float dMin = length(O + D * clamp(-b, t0, t1));
  float radialFade = 1.0 - smoothstep(uOuterRadius * 0.68, uOuterRadius, dMin);
  col *= radialFade;

  float lum = max(col.r, max(col.g, col.b));
  if (lum < 0.0012) discard;
  gl_FragColor = vec4(col, 1.0);
}`

export const cosmicSkyBakeVertex = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`

export const cosmicSkyBakeFragment = `
varying vec2 vUv;

float hash31(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}

float vnoise3(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float n000 = hash31(i);
  float n100 = hash31(i + vec3(1.0, 0.0, 0.0));
  float n010 = hash31(i + vec3(0.0, 1.0, 0.0));
  float n110 = hash31(i + vec3(1.0, 1.0, 0.0));
  float n001 = hash31(i + vec3(0.0, 0.0, 1.0));
  float n101 = hash31(i + vec3(1.0, 0.0, 1.0));
  float n011 = hash31(i + vec3(0.0, 1.0, 1.0));
  float n111 = hash31(i + vec3(1.0, 1.0, 1.0));
  float nx00 = mix(n000, n100, f.x);
  float nx10 = mix(n010, n110, f.x);
  float nx01 = mix(n001, n101, f.x);
  float nx11 = mix(n011, n111, f.x);
  return mix(mix(nx00, nx10, f.y), mix(nx01, nx11, f.y), f.z);
}

float fbm3(vec3 p) {
  float v = 0.0;
  float a = 0.54;
  for (int i = 0; i < 4; i++) {
    v += a * vnoise3(p);
    p = p * 2.07 + vec3(13.7, -9.2, 5.4);
    a *= 0.48;
  }
  return v;
}

void main() {
  float phi = vUv.x * 6.28318530718;
  float theta = (1.0 - vUv.y) * 3.14159265359;
  float sinT = sin(theta);
  vec3 d = vec3(-cos(phi) * sinT, cos(theta), sin(phi) * sinT);
  float nLarge = fbm3(d * 2.8);
  float nDetail = fbm3(d * 6.8 + vec3(nLarge * 1.35));
  float dustRift = smoothstep(0.42, 0.74, fbm3(d * 5.2 + vec3(4.2, -1.7, 2.8)));
  gl_FragColor = vec4(nLarge, nDetail, dustRift, 1.0);
}`

export const cosmicSkyVertex = `
varying vec2 vUv;
varying vec3 vDir;
void main() {
  vUv = uv;
  vDir = normalize(position);
  vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = clip.xyww;
}`

export const cosmicSkyFragment = `
uniform sampler2D uSkyMap;
uniform sampler2D uNebulaMap;
uniform float uHasSkyMap;
uniform float uHasNebulaMap;
uniform float uTime;
uniform float uOpacity;
varying vec2 vUv;
varying vec3 vDir;

float hash31(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}

void main() {
  vec3 d = normalize(vDir);
  // Deep cosmic void base with subtle vertical sapphire depth
  float band = exp(-pow(d.y * 3.1, 2.0));
  float coreFocus = exp(-pow(d.y * 4.4, 2.0)) * smoothstep(-0.3, 0.95, d.z);

  vec3 baseVoid = mix(vec3(0.011, 0.018, 0.036), vec3(0.020, 0.036, 0.068), band);

  // Sample pre-baked multi-scale 3D fBm nebula fields with continuous seamless drift
  float nLarge = 0.5;
  float nDetail = 0.5;
  float dustRift = 0.0;
  if (uHasNebulaMap > 0.5) {
    nLarge = texture2D(uNebulaMap, vec2(fract(vUv.x + uTime * 0.00035), vUv.y)).r;
    nDetail = texture2D(uNebulaMap, vec2(fract(vUv.x - uTime * 0.00048), vUv.y)).g;
    dustRift = texture2D(uNebulaMap, vUv).b;
  }

  float breatheA = 0.92 + 0.08 * sin(uTime * 0.16 + nLarge * 5.5);
  float breatheB = 0.92 + 0.08 * cos(uTime * 0.13 + nDetail * 4.8);

  vec3 cyanNeb = vec3(0.042, 0.118, 0.220) * smoothstep(0.38, 0.82, nLarge) * (0.30 + 0.70 * band) * breatheA;
  vec3 violetNeb = vec3(0.088, 0.052, 0.162) * smoothstep(0.46, 0.84, nDetail) * (0.24 + 0.76 * band) * breatheB;
  vec3 warmCore = vec3(0.165, 0.106, 0.068) * smoothstep(0.38, 0.78, nLarge * 0.7 + nDetail * 0.3) * coreFocus;

  vec3 skyCol = baseVoid + (cyanNeb + violetNeb + warmCore) * (1.0 - 0.56 * dustRift * band);

  // Softly blend the astronomical Milky Way panorama for authentic galactic structure without JPEG artifacts
  if (uHasSkyMap > 0.5) {
    vec3 tex = texture2D(uSkyMap, vUv).rgb;
    float texLum = dot(tex, vec3(0.299, 0.587, 0.114));
    vec3 graded = mix(tex, vec3(texLum * 0.72, texLum * 0.88, texLum * 1.18), 0.38);
    skyCol += graded * (0.48 + 0.12 * breatheA);
  }

  // Subtle infinite-resolution shimmering diamond-dust micro-stars along the Milky Way band
  vec3 gp = d * 155.0;
  vec3 cellA = floor(gp);
  vec3 fracA = fract(gp);
  float hA = hash31(cellA);
  if (hA > 0.965) {
    vec3 center = vec3(
      0.22 + 0.56 * hash31(cellA + 13.1),
      0.22 + 0.56 * hash31(cellA + 29.7),
      0.22 + 0.56 * hash31(cellA + 53.3)
    );
    vec3 diff = fracA - center;
    float d2 = dot(diff, diff);
    float pinpoint = exp(-d2 * 140.0);
    if (pinpoint > 0.01) {
      float phase = hash31(cellA + 17.3) * 6.28318;
      float freq = 1.0 + hash31(cellA + 41.7) * 2.2;
      float tw = 0.42 + 0.58 * sin(uTime * freq + phase);
      float mask = smoothstep(0.965, 0.998, hA) * (0.28 + 0.72 * band);
      vec3 microTint = mix(vec3(0.68, 0.85, 1.0), vec3(1.0, 0.91, 0.76), hash31(cellA + 91.1));
      skyCol += microTint * pinpoint * mask * tw * 0.75;
    }
  }

  gl_FragColor = vec4(skyCol * uOpacity, uOpacity);
}`

export const dynamicStarsVertex = `
attribute vec3 color;
attribute float aSize;
attribute vec3 aTwinkle;
attribute float aHero;
uniform float uTime;
uniform float uPixelRatio;
uniform float uOpacity;
varying vec3 vColor;
varying float vAlpha;
varying float vHero;
varying float vPulse;

void main() {
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;

  float w = 0.62 * sin(uTime * aTwinkle.y + aTwinkle.x)
          + 0.38 * sin(uTime * (aTwinkle.y * 1.73) + aTwinkle.x * 2.17);
  float pulse = clamp(1.0 + aTwinkle.z * w, 0.32, 1.48);

  float ptSize = aSize * uPixelRatio * (0.90 + 0.14 * pulse);
  gl_PointSize = clamp(ptSize, 1.25, 28.0 * uPixelRatio);

  vColor = color;
  vAlpha = uOpacity * (0.68 + 0.32 * pulse);
  vHero = aHero;
  vPulse = pulse;
}`

export const dynamicStarsFragment = `
varying vec3 vColor;
varying float vAlpha;
varying float vHero;
varying float vPulse;

void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(p, p);
  if (r2 >= 1.0) discard;

  // Crisp luminous incandescent core + silky colored airy halo
  float core = exp(-r2 * 15.5);
  float halo = exp(-r2 * 4.2) * (1.0 - smoothstep(0.55, 1.0, r2));

  // Delicate 4-point optical diffraction spikes on bright navigational hero stars
  float spikes = 0.0;
  if (vHero > 0.02) {
    float sx = exp(-abs(p.y) * 16.5 - abs(p.x) * 2.6);
    float sy = exp(-abs(p.x) * 16.5 - abs(p.y) * 2.6);
    float diag = exp(-abs(p.x - p.y) * 18.0 - abs(p.x + p.y) * 5.0) * 0.25
               + exp(-abs(p.x + p.y) * 18.0 - abs(p.x - p.y) * 5.0) * 0.25;
    spikes = (sx + sy + diag) * vHero * (0.48 + 0.26 * vPulse) * (1.0 - smoothstep(0.65, 1.0, r2));
  }

  float energy = core * 1.05 + halo * 0.44 + spikes * 0.55;
  vec3 tint = mix(vColor, vec3(1.0, 0.99, 0.97), clamp(core * 0.82, 0.0, 1.0));
  float alpha = clamp(energy * vAlpha, 0.0, 1.0);
  if (alpha < 0.004) discard;
  gl_FragColor = vec4(tint * alpha, alpha);
}`

export const shootingStarsVertex = `
attribute vec3 aStartDir;
attribute vec3 aTangent;
attribute vec4 aTiming;
attribute vec2 aCorner;
attribute vec3 aTint;
uniform float uTime;
varying vec2 vUv;
varying vec3 vTint;
varying float vAlpha;

void main() {
  float cycleT = mod(uTime + aTiming.x, aTiming.y);
  float progress = cycleT / aTiming.z;
  vUv = aCorner;
  vTint = aTint;

  if (progress >= 1.0 || progress <= 0.0) {
    vAlpha = 0.0;
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }

  float headFrac = 1.0 - pow(1.0 - progress, 1.45);
  float envelope = sin(progress * 3.14159265);
  float tailFrac = max(0.0, headFrac - 0.36 * envelope);
  float s = mix(tailFrac, headFrac, aCorner.x) * aTiming.w;

  vec3 dir = normalize(aStartDir * cos(s) + aTangent * sin(s));
  vec3 travel = normalize(-aStartDir * sin(s) + aTangent * cos(s));
  vec3 sideVec = normalize(cross(dir, travel));

  float halfWidth = mix(2.2, 10.0, aCorner.x);
  vec3 localPos = dir * 6800.0 + sideVec * (aCorner.y * halfWidth);

  vAlpha = envelope;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(localPos, 1.0);
}`

export const shootingStarsFragment = `
varying vec2 vUv;
varying vec3 vTint;
varying float vAlpha;

void main() {
  if (vAlpha <= 0.001) discard;
  float across = exp(-vUv.y * vUv.y * 5.8);
  float trail = pow(clamp(vUv.x, 0.0, 1.0), 2.3) * 0.58;
  float head = exp(-pow((vUv.x - 0.94) / 0.075, 2.0)) * 1.15;
  float energy = across * (trail + head) * vAlpha * 0.72;
  if (energy < 0.004) discard;
  vec3 col = mix(vTint, vec3(1.0), smoothstep(0.76, 1.0, vUv.x));
  gl_FragColor = vec4(col * energy, energy);
}`
