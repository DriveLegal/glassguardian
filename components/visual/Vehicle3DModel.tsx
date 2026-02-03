// components/visual/Vehicle3DModel.tsx
"use client";

import * as React from "react";
import * as THREE from "three";
import { getVehicleType, VehicleType } from "./VehicleModelMapper";

type Props = {
  vehicleType?: VehicleType;
  make?: string;
  model?: string;
  color?: string; // hex or css color
  className?: string;
};

export default function Vehicle3DModel({
  vehicleType,
  make,
  model,
  color = "#FFFFFF",
  className = "",
}: Props) {
  const mountRef = React.useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = React.useState(true);

  const detectedType: VehicleType = vehicleType || getVehicleType(make, model);

  React.useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const width = mount.clientWidth || 600;
    const height = mount.clientHeight || 250;

    const scene = new THREE.Scene();
    scene.background = null;

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });

    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    const carGroup = new THREE.Group();

    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color),
      metalness: 0.7,
      roughness: 0.2,
      envMapIntensity: 1,
    });

    const windowMaterial = new THREE.MeshStandardMaterial({
      color: 0x1a1a1a,
      transparent: true,
      opacity: 0.7,
      metalness: 0.9,
      roughness: 0.1,
    });

    // Body variation by type
    if (detectedType === "truck") {
      const body = new THREE.Mesh(new THREE.BoxGeometry(5, 1.5, 2.2), bodyMaterial);
      body.position.y = 1;
      body.castShadow = true;
      carGroup.add(body);

      const cabin = new THREE.Mesh(new THREE.BoxGeometry(2, 1.3, 2), bodyMaterial);
      cabin.position.set(-1, 2.2, 0);
      cabin.castShadow = true;
      carGroup.add(cabin);

      const bed = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.8, 2.2), bodyMaterial);
      bed.position.set(1.5, 1.5, 0);
      bed.castShadow = true;
      carGroup.add(bed);
    } else if (detectedType === "suv") {
      const body = new THREE.Mesh(new THREE.BoxGeometry(4.5, 1.6, 2.2), bodyMaterial);
      body.position.y = 1.1;
      body.castShadow = true;
      carGroup.add(body);

      const cabin = new THREE.Mesh(new THREE.BoxGeometry(3, 1.4, 2), bodyMaterial);
      cabin.position.set(0, 2.3, 0);
      cabin.castShadow = true;
      carGroup.add(cabin);
    } else if (detectedType === "van") {
      const body = new THREE.Mesh(new THREE.BoxGeometry(5, 2.2, 2.3), bodyMaterial);
      body.position.y = 1.4;
      body.castShadow = true;
      carGroup.add(body);
    } else if (detectedType === "sports") {
      const body = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.9, 2.1), bodyMaterial);
      body.position.y = 0.5;
      body.castShadow = true;
      carGroup.add(body);

      const cabin = new THREE.Mesh(new THREE.BoxGeometry(2, 0.7, 1.7), bodyMaterial);
      cabin.position.set(0.3, 1.1, 0);
      cabin.castShadow = true;
      carGroup.add(cabin);
    } else {
      const body = new THREE.Mesh(new THREE.BoxGeometry(4.5, 1.3, 2), bodyMaterial);
      body.position.y = 0.7;
      body.castShadow = true;
      carGroup.add(body);

      const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.5, 1.1, 1.8), bodyMaterial);
      cabin.position.set(0.3, 1.7, 0);
      cabin.castShadow = true;
      carGroup.add(cabin);

      const hood = new THREE.Mesh(new THREE.BoxGeometry(1, 0.3, 1.9), bodyMaterial);
      hood.position.set(-2, 1, 0);
      hood.rotation.z = -0.2;
      hood.castShadow = true;
      carGroup.add(hood);
    }

    // Windshield (all types)
    const windshieldGeo = new THREE.PlaneGeometry(1.8, 0.9);
    const windshield = new THREE.Mesh(windshieldGeo, windowMaterial);
    windshield.position.set(
      -0.5,
      detectedType === "sports" ? 1.2 : detectedType === "suv" ? 2.3 : 1.7,
      1.01
    );
    windshield.rotation.y = 0.15;
    carGroup.add(windshield);

    // Wheels
    const wheelRadius =
      detectedType === "truck" ? 0.55 : detectedType === "suv" ? 0.5 : detectedType === "sports" ? 0.4 : 0.45;

    const tireGeometry = new THREE.CylinderGeometry(wheelRadius, wheelRadius, 0.35, 32);
    const tireMaterial = new THREE.MeshStandardMaterial({
      color: 0x1a1a1a,
      roughness: 0.9,
      metalness: 0.1,
    });

    const rimGeometry = new THREE.CylinderGeometry(wheelRadius * 0.6, wheelRadius * 0.6, 0.4, 32);
    const rimMaterial = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.8, roughness: 0.2 });

    const wheelYPos = wheelRadius;
    const wheelSpacing = detectedType === "truck" ? 2 : detectedType === "suv" ? 1.8 : 1.5;

    const wheelPositions = [
      { x: -wheelSpacing, z: 1.2 },
      { x: -wheelSpacing, z: -1.2 },
      { x: wheelSpacing, z: 1.2 },
      { x: wheelSpacing, z: -1.2 },
    ];

    wheelPositions.forEach((pos) => {
      const tire = new THREE.Mesh(tireGeometry, tireMaterial);
      const rim = new THREE.Mesh(rimGeometry, rimMaterial);
      tire.rotation.z = Math.PI / 2;
      rim.rotation.z = Math.PI / 2;
      tire.position.set(pos.x, wheelYPos, pos.z);
      rim.position.set(pos.x, wheelYPos, pos.z);
      tire.castShadow = true;
      carGroup.add(tire);
      carGroup.add(rim);
    });

    scene.add(carGroup);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 1);
    mainLight.position.set(8, 8, 8);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 2048;
    mainLight.shadow.mapSize.height = 2048;
    scene.add(mainLight);

    const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
    fillLight.position.set(-8, 5, -5);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0x88ccff, 0.4);
    rimLight.position.set(0, -5, -8);
    scene.add(rimLight);

    // Ground for shadow
    const groundGeometry = new THREE.PlaneGeometry(20, 20);
    const groundMaterial = new THREE.ShadowMaterial({ opacity: 0.15 });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.1;
    ground.receiveShadow = true;
    scene.add(ground);

    camera.position.set(6, 3.5, 6);
    camera.lookAt(0, detectedType === "truck" ? 1.2 : 0.8, 0);

    let animationId = 0;
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      carGroup.rotation.y += 0.003;
      renderer.render(scene, camera);
    };

    animate();
    setLoading(false);

    const handleResize = () => {
      const newWidth = mountRef.current?.clientWidth || width;
      const newHeight = mountRef.current?.clientHeight || height;
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", handleResize);
      if (mount && renderer.domElement) {
        try {
          mount.removeChild(renderer.domElement);
        } catch {}
      }
      tireGeometry.dispose();
      rimGeometry.dispose();
      groundGeometry.dispose();
      bodyMaterial.dispose();
      windowMaterial.dispose();
      tireMaterial.dispose();
      rimMaterial.dispose();
      groundMaterial.dispose();
      windshieldGeo.dispose();
      renderer.dispose();
    };
  }, [color, detectedType, make, model]);

  return (
    <div ref={mountRef} className={`w-full ${className}`} style={{ height: "250px" }}>
      {loading && (
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
        </div>
      )}
    </div>
  );
}