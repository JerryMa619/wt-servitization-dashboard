// Hardware references from the rig ABox and Chapter 5 commissioning plan, not live devices.
export const bladeSensorReference = {
  name: 'Accel 18 Click (MC3419)',
  type: 'Triaxial accelerometer',
  observable: 'Blade acceleration / flap-wise vibration',
  placement: 'Blade A / 80% span / suction side',
  entity: 'rig:Accel18-onBlade-A',
  uri: 'http://dtservit.org/ontology/rig#Accel18-onBlade-A',
  source: 'Rig ABox / Appendix D, Table D.2',
  connection: 'Reference configuration / hardware not connected',
  identity: 'Device serial ID and calibration record not supplied'
} as const;

export const auxiliaryChannelReferences = [
  { label: 'Wind speed instrument', value: 'Anemometer / model not recorded' },
  { label: 'Wind direction instrument', value: 'Wind vane / model not recorded' },
  { label: 'Rotor-speed channel', value: 'Generator-phase tachometer pulses / planned channel' },
  { label: 'Electrical channels', value: 'Generator voltage / load-current shunt / models not recorded' }
] as const;

export const bladeSensorFields = [
  { label: 'Reference sensor', value: bladeSensorReference.name },
  { label: 'Sensor type', value: bladeSensorReference.type },
  { label: 'Reference observable', value: bladeSensorReference.observable },
  { label: 'Reference placement', value: bladeSensorReference.placement },
  { label: 'Hardware status', value: bladeSensorReference.connection },
  { label: 'Device identity', value: bladeSensorReference.identity }
] as const;

export const derivedConditionNote = 'Crack length and RUL are replay/model outputs, not direct sensor measurements';
