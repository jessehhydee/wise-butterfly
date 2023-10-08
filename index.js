import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import SimplexNoise from 'https://cdn.skypack.dev/simplex-noise@3.0.0';

const container = document.querySelector('.container');
const canvas    = document.querySelector('.canvas');

let
  sizes,
  scene,
  camera,
  renderer,
  controls,
  centerTile,
  tileWidth,
  amountOfParticlesInTile,
  simplex,
  maxHeight,
  particleManipulator,
  dummyMatrix,
  particleMeshes,
  prevActivePathPos,
  activePathPos,
  sceneRendered;

const setScene = async () => {

  sizes = {
    width:  container.offsetWidth,
    height: container.offsetHeight
  };

  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(60, sizes.width / sizes.height, 1, 400);
  camera.position.set(0, 100, 180);
  
  renderer = new THREE.WebGLRenderer({
    canvas:     canvas,
    antialias:  false,
    alpha:      true
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  scene.add(new THREE.HemisphereLight(0xffffbb, 0x080820, 1));

  sceneRendered = false;

  setControls();
  setTileValues();
  createTile();
  createSurroundingTiles(`{"x":${centerTile.xFrom},"y":${centerTile.yFrom}}`);
  createPath();
  resize();
  listenTo();
  render();

  sceneRendered = true;

};

const setControls = () => {

  controls                = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping  = true;

};

const setTileValues = () => {

  const centerTileFromTo = 30;

  centerTile = {
    xFrom:  -centerTileFromTo,
    xTo:    centerTileFromTo,
    yFrom:  -centerTileFromTo,
    yTo:    centerTileFromTo
  };
  tileWidth               = centerTileFromTo * 2; // diff between xFrom - xTo (not accounting for 0)
  amountOfParticlesInTile = Math.pow((centerTile.xTo + 1) - centerTile.xFrom, 2); // +1 accounts for 0
  simplex                 = new SimplexNoise();
  maxHeight               = 30;
  particleManipulator     = new THREE.Object3D();
  dummyMatrix             = new THREE.Matrix4();
  particleMeshes          = [];

};

const createSurroundingTiles = (newActiveTile) => {

  const setCenterTile = (parsedCoords) => {
    centerTile = {
      xFrom:  parsedCoords.x,
      xTo:    parsedCoords.x + tileWidth,
      yFrom:  parsedCoords.y,
      yTo:    parsedCoords.y + tileWidth
    }
  };

  const parsedCoords = JSON.parse(newActiveTile);

  setCenterTile(parsedCoords);

  tileYNegative();

  tileXPositive();

  tileYPositive();
  tileYPositive();

  tileXNegative();
  tileXNegative();

  tileYNegative();
  tileYNegative();

  setCenterTile(parsedCoords);

};

const tileYNegative = () => {

  centerTile.yFrom -= tileWidth;
  centerTile.yTo -= tileWidth;
  createTile();

};

const tileYPositive = () => {

  centerTile.yFrom += tileWidth;
  centerTile.yTo += tileWidth;
  createTile();

};

const tileXNegative = () => {

  centerTile.xFrom -= tileWidth;
  centerTile.xTo -= tileWidth;
  createTile();

};

const tileXPositive = () => {

  centerTile.xFrom += tileWidth;
  centerTile.xTo += tileWidth;
  createTile();

};

const createTile = () => {

  const tileToPosition = (tileX, height, tileY) => {
    return new THREE.Vector3((tileX + (tileY % 2) * 0.5) * 1.68, height, tileY * 1.535);
  };

  const setParticleMesh = () => {

    const geo   = new THREE.CircleGeometry(0.5, 5);
    const mat   = new THREE.MeshStandardMaterial({
      color:  0x31759D, 
      side:   THREE.DoubleSide
    });
    const mesh  = new THREE.InstancedMesh(geo, mat, amountOfParticlesInTile);
  
    return mesh;

  };

  const particle        = setParticleMesh();
  let   particleCounter = 0;
  
  for(let i = centerTile.xFrom; i <= centerTile.xTo; i++) {
    for(let e = centerTile.yFrom; e <= centerTile.yTo; e++) {

      let noise1    = (simplex.noise2D(i * 0.015, e * 0.015) + 1.3) * 0.3;
      noise1        = Math.pow(noise1, 1.2);
      let noise2    = (simplex.noise2D(i * 0.015, e * 0.015) + 1) * 0.75;
      noise2        = Math.pow(noise2, 1.2);
      const height  = noise1 * noise2 * maxHeight;

      const pos = tileToPosition(i, height, e);
      particleManipulator.position.set(pos.x, pos.y, pos.z);

      particleManipulator.updateMatrix();
      particle.setMatrixAt(particleCounter, particleManipulator.matrix);

      particleCounter++;

      if(!particleMeshes.length)
        if(i === centerTile.xFrom && e === centerTile.yFrom) activePathPos = pos;

    }
  }

  scene.add(particle);
  particleMeshes.push(particle);

};

const createPath = () => {

  const setParticleMesh = () => {

    const geo   = new THREE.CircleGeometry(1.2, 5);
    const mat   = new THREE.MeshStandardMaterial({
      color:  0xffffff, 
      side:   THREE.DoubleSide
    });
    const mesh  = new THREE.InstancedMesh(geo, mat, pathSize);
  
    return mesh;

  };

  const getSurroundingPositions = () => {

    const surroundingPositions = [];

    for(let i = 0; i < particleMeshes.length; i++) {
      for(let e = 0; e < amountOfParticlesInTile; e++) {
  
        particleMeshes[i].getMatrixAt(e, dummyMatrix);
        dummyMatrix.decompose(
          particleManipulator.position, 
          particleManipulator.quaternion, 
          particleManipulator.scale
        );

        if(activePathPos.distanceTo(particleManipulator.position) < 5)
          if(activePathPos !== particleManipulator.position && particleManipulator.position !== prevActivePathPos)
            surroundingPositions.push(JSON.stringify(particleManipulator.position));
  
      }
    }

    return surroundingPositions;

  }
  
  const getDir = (from, to) => {

    if(!from) return -1;

    const relativePos = new THREE.Vector3();
    relativePos.subVectors(to, from);

    return new THREE.Vector3(0, 0, 1).dot(relativePos);

  }

  const getAvailalbePositions = (positions, dirForward) => {

    const availablePositions = [];

    for(let i = 0; i < positions.length; i++) {

      let pos   = JSON.parse(positions[i]);
      pos       = new THREE.Vector3(pos.x, pos.y, pos.z);
      const dir = getDir(activePathPos, pos);

      // Only accepts positions that are situated in front of the path.
      // Keeps path going in a similar direction.
      if((dir > dirForward - (Math.PI / 2.5) && dir < dirForward + (Math.PI / 2.5)) || dirForward === -1)
        availablePositions.push(pos);

    }

    // Sorting from lowest to highest based on the y axis.
    // [0] will always be the lowaest of the collection.
    availablePositions.sort((a, b) => a.y - b.y);

    return availablePositions;

  };

  const pathSize      = 30;
  const pathParticle  = setParticleMesh();

  for(let i = 0; i < pathSize; i++) {

    const surroundingPositions  = getSurroundingPositions();
    const dir                   = getDir(prevActivePathPos, activePathPos);
    const positions             = getAvailalbePositions(surroundingPositions, dir);
    prevActivePathPos           = activePathPos;

    if(JSON.stringify(activePathPos) !== JSON.stringify(positions[0])) activePathPos = positions[0];
    else activePathPos = positions[1];

    particleManipulator.position.set(activePathPos.x, activePathPos.y + 5, activePathPos.z);
    particleManipulator.updateMatrix();
    pathParticle.setMatrixAt(i, particleManipulator.matrix);
    
  }

  scene.add(pathParticle);

};

const resize = () => {

  sizes = {
    width:  container.offsetWidth,
    height: container.offsetHeight
  };

  camera.aspect = sizes.width / sizes.height;
  camera.updateProjectionMatrix();

  renderer.setSize(sizes.width, sizes.height);

};

const listenTo = () => {
  window.addEventListener('resize', resize.bind(this));
};

const updateParticles = () => {

  for(let i = 0; i < particleMeshes.length; i++) {
    for(let e = 0; e < amountOfParticlesInTile; e++) {

      particleMeshes[i].getMatrixAt(e, dummyMatrix);
      dummyMatrix.decompose(
        particleManipulator.position, 
        particleManipulator.quaternion, 
        particleManipulator.scale
      );

      particleManipulator.lookAt(camera.position);

      particleManipulator.updateMatrix();
      particleMeshes[i].setMatrixAt(e, particleManipulator.matrix);

    }

    particleMeshes[i].instanceMatrix.needsUpdate = true;
  }

};

const render = () => {

  if(sceneRendered) updateParticles();

  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(render.bind(this));

};

setScene();
