import { Composition } from 'remotion';
import { ScheduleCCommercial } from './ScheduleCCommercial';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="ScheduleCCommercial"
        component={ScheduleCCommercial}
        durationInFrames={450} // 15 seconds at 30fps
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
