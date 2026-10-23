import { boxCorners, fitProjection, type Point3 } from "../../anatomy-kit/iso-kit";

export const WIDTH=680;
export const HEIGHT=360;
export const BASE={x:-112,y:-66,w:224,d:132,r:7};
export const BASE_Z=-5;
export const P=fitProjection([
  ...boxCorners(BASE,BASE_Z-4,0),
  ...boxCorners({x:-91,y:-55,w:34,d:27,r:2},0,37),
  ...boxCorners({x:-13,y:-57,w:44,d:24,r:3},0,36),
  ...boxCorners({x:-29,y:-19,w:58,d:38,r:3},0,17),
  ...boxCorners({x:57,y:-21,w:53,d:42,r:3},0,37),
  ...boxCorners({x:-96,y:-27,w:190,d:54,r:4},0,16),
] as Point3[],WIDTH,HEIGHT,{pad:22,azimuth:48,elevation:30});
