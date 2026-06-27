import React, { useState, useEffect, useRef } from 'react';
import {
    Modal,
    View,
    Image,
    StyleSheet,
    TouchableOpacity,
    Dimensions,
    Alert,
    Text,
} from 'react-native';
import {
    PinchGestureHandler,
    PanGestureHandler,
    TapGestureHandler,
    GestureHandlerRootView,
    State,
    type PinchGestureHandlerGestureEvent,
    type PanGestureHandlerGestureEvent,
    type TapGestureHandlerGestureEvent,
} from 'react-native-gesture-handler';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    runOnJS,
} from 'react-native-reanimated';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Share from 'react-native-share';
import RNFS from 'react-native-fs';
import { spacing } from '../../theme/spacing';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ImageViewerProps {
    visible: boolean;
    images: string[];
    initialIndex?: number;
    onClose: () => void;
    imageUri?: string;
    highQualityUri?: string;
}

export const ImageViewer: React.FC<ImageViewerProps> = ({
    visible,
    images: imagesProp,
    initialIndex = 0,
    onClose,
    imageUri,
    highQualityUri,
}) => {
    const images = imagesProp?.length ? imagesProp : imageUri ? [imageUri] : [];

    const [index, setIndex] = useState(initialIndex);
    const [resolvedUri, setResolvedUri] = useState('');

    const scale = useSharedValue(1);
    const baseScale = useSharedValue(1);
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const lastX = useSharedValue(0);
    const lastY = useSharedValue(0);

    const pinchRef = useRef(null);
    const panRef = useRef(null);
    const doubleTapRef = useRef(null);

    const reset = () => {
        scale.value = withSpring(1);
        baseScale.value = 1;
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        lastX.value = 0;
        lastY.value = 0;
    };

    useEffect(() => {
        if (!visible) { reset(); return; }
        setIndex(initialIndex);
    }, [visible, initialIndex]);

    useEffect(() => {
        reset();
        if (!images[index]) { setResolvedUri(''); return; }
        const uri = images[index];
        const resolve = async () => {
            if (index === 0 && highQualityUri) {
                const p = highQualityUri.replace('file://', '');
                if (await RNFS.exists(p)) { setResolvedUri(highQualityUri); return; }
            }
            const p = uri.replace('file://', '');
            setResolvedUri((await RNFS.exists(p)) ? uri : '');
        };
        resolve();
    }, [index, images, visible]);

    const goNext = () => {
        if (index < images.length - 1) { reset(); setIndex(i => i + 1); }
    };
    const goPrev = () => {
        if (index > 0) { reset(); setIndex(i => i - 1); }
    };

    const onPinchEvent = (event: PinchGestureHandlerGestureEvent) => {
        'worklet';
        scale.value = Math.min(5, Math.max(1, baseScale.value * event.nativeEvent.scale));
    };

    const onPinchStateChange = (event: PinchGestureHandlerGestureEvent) => {
        'worklet';
        if (event.nativeEvent.oldState === State.ACTIVE) {
            baseScale.value = scale.value;
            if (scale.value < 1) {
                scale.value = withSpring(1);
                baseScale.value = 1;
                translateX.value = withSpring(0);
                translateY.value = withSpring(0);
                lastX.value = 0;
                lastY.value = 0;
            }
        }
    };

    const onPanEvent = (event: PanGestureHandlerGestureEvent) => {
        'worklet';
        translateX.value = lastX.value + event.nativeEvent.translationX;
        translateY.value = lastY.value + event.nativeEvent.translationY;
    };

    const onPanStateChange = (event: PanGestureHandlerGestureEvent) => {
        'worklet';
        if (event.nativeEvent.oldState === State.ACTIVE) {
            if (scale.value <= 1) {
                if (event.nativeEvent.translationY > 80) {
                    runOnJS(onClose)();
                    return;
                }
                if (event.nativeEvent.translationX < -60) {
                    runOnJS(goNext)();
                } else if (event.nativeEvent.translationX > 60) {
                    runOnJS(goPrev)();
                }
                translateX.value = withSpring(0);
                translateY.value = withSpring(0);
                lastX.value = 0;
                lastY.value = 0;
            } else {
                lastX.value = translateX.value;
                lastY.value = translateY.value;
            }
        }
    };

    const onDoubleTap = (event: TapGestureHandlerGestureEvent) => {
        'worklet';
        if (event.nativeEvent.state === State.ACTIVE) {
            if (scale.value > 1) {
                scale.value = withSpring(1);
                baseScale.value = 1;
                translateX.value = withSpring(0);
                translateY.value = withSpring(0);
                lastX.value = 0;
                lastY.value = 0;
            } else {
                scale.value = withSpring(2.5);
                baseScale.value = 2.5;
            }
        }
    };

    const animStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: translateX.value },
            { translateY: translateY.value },
            { scale: scale.value },
        ],
    }));

    const handleShare = async () => {
        try {
            if (!resolvedUri) { Alert.alert('Error', 'Image not found.'); return; }
            const absolutePath = resolvedUri.replace('file://', '');
            if (!(await RNFS.exists(absolutePath))) { Alert.alert('Error', 'Image file not found.'); return; }
            const cachePath = `${RNFS.CachesDirectoryPath}/share_receipt_${Date.now()}.jpg`;
            await RNFS.copyFile(absolutePath, cachePath);
            await Share.open({ url: `file://${cachePath}`, type: 'image/jpeg', failOnCancel: false });
        } catch (e: any) {
            if (e?.message?.includes('User did not share') || e?.message?.includes('CANCELLED') || e?.error === 'userCancel') return;
            Alert.alert('Error', 'Failed to share image.');
        }
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
            <GestureHandlerRootView style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity style={styles.iconBtn} onPress={onClose}>
                        <MaterialCommunityIcons name="close" size={24} color="#FFF" />
                    </TouchableOpacity>
                    {images.length > 1 && (
                        <Text style={styles.counter}>{index + 1} / {images.length}</Text>
                    )}
                    <TouchableOpacity style={styles.iconBtn} onPress={handleShare}>
                        <MaterialCommunityIcons name="share-variant" size={22} color="#FFF" />
                    </TouchableOpacity>
                </View>

                {/* Gestures */}
                <PanGestureHandler
                    ref={panRef}
                    onGestureEvent={onPanEvent}
                    onHandlerStateChange={onPanStateChange}
                    simultaneousHandlers={[pinchRef, doubleTapRef]}
                    minPointers={1}
                    maxPointers={2}
                >
                    <Animated.View style={styles.fill}>
                        <PinchGestureHandler
                            ref={pinchRef}
                            onGestureEvent={onPinchEvent}
                            onHandlerStateChange={onPinchStateChange}
                            simultaneousHandlers={[panRef]}
                        >
                            <Animated.View style={styles.fill}>
                                <TapGestureHandler
                                    ref={doubleTapRef}
                                    onHandlerStateChange={onDoubleTap}
                                    numberOfTaps={2}
                                >
                                    <Animated.View style={[styles.imageWrap, animStyle]}>
                                        {resolvedUri ? (
                                            <Image
                                                source={{ uri: resolvedUri }}
                                                style={styles.image}
                                                resizeMode="contain"
                                            />
                                        ) : null}
                                    </Animated.View>
                                </TapGestureHandler>
                            </Animated.View>
                        </PinchGestureHandler>
                    </Animated.View>
                </PanGestureHandler>

                {/* Nav arrows */}
                {images.length > 1 && (
                    <>
                        {index > 0 && (
                            <TouchableOpacity style={[styles.navBtn, styles.navLeft]} onPress={goPrev}>
                                <MaterialCommunityIcons name="chevron-left" size={36} color="#FFF" />
                            </TouchableOpacity>
                        )}
                        {index < images.length - 1 && (
                            <TouchableOpacity style={[styles.navBtn, styles.navRight]} onPress={goNext}>
                                <MaterialCommunityIcons name="chevron-right" size={36} color="#FFF" />
                            </TouchableOpacity>
                        )}
                    </>
                )}

                {/* Hint */}
                <View style={styles.footer}>
                    <Text style={styles.hint}>
                        {images.length > 1
                            ? 'Swipe left/right to navigate • Pinch to zoom • Swipe down to close'
                            : 'Pinch to zoom • Double tap to zoom • Swipe down to close'}
                    </Text>
                </View>
            </GestureHandlerRootView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    fill: { flex: 1 },
    header: {
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
        paddingTop: 48, paddingHorizontal: spacing.md, paddingBottom: spacing.md,
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    iconBtn: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center',
    },
    counter: { color: '#FFF', fontSize: 16, fontWeight: '600' },
    imageWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    image: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT },
    navBtn: {
        position: 'absolute', top: '50%', zIndex: 10,
        backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 24, padding: 4,
    },
    navLeft: { left: spacing.sm },
    navRight: { right: spacing.sm },
    footer: {
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: spacing.md, paddingBottom: 40,
        backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 10,
    },
    hint: { color: 'rgba(255,255,255,0.7)', fontSize: 12, textAlign: 'center' },
});
