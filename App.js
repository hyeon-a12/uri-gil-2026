import * as ImagePicker from 'expo-image-picker';
import { Button, View, Text } from 'react-native-web';
import { useState } from 'react';

export default function App() {
  const [status, setStatus] = useState('');

  const pickAndUpload = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setStatus('카메라 권한이 필요해요');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      videoMaxDuration: 60,
    });

    if (result.canceled) return;

    setStatus('업로드 중...');
    const formData = new FormData();
    formData.append('video', {
      uri: result.assets[0].uri,
      type: 'video/mp4',
      name: 'upload.mp4',
    });

    try {
      const res = await fetch('http://172.30.1.65:3000/process-video', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      setStatus('완료했어요 ' + JSON.stringify(data));
    } catch (err) {
      setStatus('에러: ' + err.message);
    }
  };

  return (
    <View
      style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
      }}
    >
      <Button
        title="촬영 후 업로드"
        onPress={pickAndUpload}
      />
      <Text>{status}</Text>
    </View>
  );
}
