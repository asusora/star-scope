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
