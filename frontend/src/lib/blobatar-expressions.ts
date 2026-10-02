type AvatarPose = {
  esx: number
  esy: number
  tilt: number
  edy: number
  edx: number
  esx2: number
  esy2: number
  tilt2: number
  edy2: number
  lock: number
  heat: number
  shake: number
  rock: number
  bdy: number
}

export interface AvatarExpression {
  readonly p: AvatarPose
  readonly vars: (pose: AvatarPose) => Record<string, string>
}

const idlePose: AvatarPose = {
  esx: 1, esy: 1, tilt: 0, edy: 0, edx: 0, esx2: 0, esy2: 0,
  tilt2: 0, edy2: 0, lock: 0, heat: 0, shake: 0, rock: 0, bdy: 0,
}

function poseVars(pose: AvatarPose) {
  return Object.entries(pose).reduce<Record<string, string>>((vars, [key, value]) => {
    if (key !== 'heat' && value !== idlePose[key as keyof AvatarPose]) vars[`--mo-${key}`] = String(value)
    return vars
  }, {})
}

function expression(p: AvatarPose): AvatarExpression {
  return { p, vars: poseVars }
}

// These poses use Blobatar's public motion variables, avoiding a package subpath
// that is not resolved consistently by Vite's development dependency optimizer.
export const happy = expression({ ...idlePose, esx: 1.72, esy: .3, tilt: 8, edy: -1.5, edx: 1.5, esx2: .08, esy2: .05, tilt2: -16, lock: 1, bdy: -2.2 })
export const surprised = expression({ ...idlePose, esx: 1.34, esy: 1.2, tilt: -6, edy: -1.05, edx: .5, esx2: .05, esy2: .07, tilt2: 3, lock: 1, bdy: -1.4 })
export const wink = expression({ ...idlePose, esx: 1.32, esy: .76, tilt: 5, edy: -.6, edx: .8, esx2: .26, esy2: -.56, tilt2: -11, lock: 1, bdy: -1.1 })
