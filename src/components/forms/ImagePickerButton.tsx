import React, { useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Image,
    Alert,
    ScrollView,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import type { ImagePickerResponse } from 'react-native-image-picker';
import { spacing, borderRadius } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { useThemeColors } from '../../hooks/useThemeColors';

const MAX_IMAGES = 5;

interface ImagePickerButtonProps {
    onImagesChanged: (uris: string[]) => void;
    selectedImageUris: string[];
    disabled?: boolean;
}

export const ImagePickerButton: React.FC<ImagePickerButtonProps> = ({
    onImagesChanged,
    selectedImageUris,
    disabled = false,
}) => {
    const themeColors = useThemeColors();
    const [loading, setLoading] = useState(false);

    const pickImage = async (source: 'camera' | 'gallery') => {
        if (disabled || loading || selectedImageUris.length >= MAX_IMAGES) return;
        setLoading(true);
        try {
            const options = { mediaType: 'photo' as const, quality: 1 as const };
            const response: ImagePickerResponse =
                source === 'camera'
                    ? await launchCamera(options)
                    : await launchImageLibrary(options);

            if (!response.didCancel && !response.errorCode && response.assets?.[0]?.uri) {
                onImagesChanged([...selectedImageUris, response.assets[0].uri]);
            }
        } catch (e) {
            Alert.alert('Error', 'Failed to pick image.');
        } finally {
            setLoading(false);
        }
    };

    const removeImage = (index: number) => {
        onImagesChanged(selectedImageUris.filter((_, i) => i !== index));
    };

    const showSourceOptions = () => {
        Alert.alert('Attach Receipt', 'Choose source', [
            { text: 'Camera', onPress: () => pickImage('camera') },
            { text: 'Gallery', onPress: () => pickImage('gallery') },
            { text: 'Cancel', style: 'cancel' },
        ]);
    };

    return (
        <View style={styles.container}>
            <Text style={[styles.label, { color: themeColors.text }]}>
                Receipt Images ({selectedImageUris.length}/{MAX_IMAGES})
            </Text>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.row}>
                {selectedImageUris.map((uri, index) => (
                    <View key={index} style={styles.thumbWrap}>
                        <Image source={{ uri }} style={styles.thumb} resizeMode="cover" />
                        <TouchableOpacity
                            style={styles.removeBtn}
                            onPress={() => removeImage(index)}
                        >
                            <MaterialCommunityIcons name="close" size={16} color="#FFF" />
                        </TouchableOpacity>
                    </View>
                ))}

                {selectedImageUris.length < MAX_IMAGES && (
                    <TouchableOpacity
                        style={[styles.addBtn, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
                        onPress={showSourceOptions}
                        disabled={disabled || loading}
                    >
                        <MaterialCommunityIcons
                            name={loading ? 'loading' : 'camera-plus'}
                            size={28}
                            color={themeColors.primary}
                        />
                        <Text style={[styles.addText, { color: themeColors.textSecondary }]}>Add</Text>
                    </TouchableOpacity>
                )}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginVertical: spacing.md,
    },
    label: {
        ...typography.body,
        fontWeight: '600',
        marginBottom: spacing.sm,
    },
    row: {
        flexDirection: 'row',
    },
    thumbWrap: {
        width: 90,
        height: 90,
        borderRadius: borderRadius.md,
        marginRight: spacing.sm,
        position: 'relative',
    },
    thumb: {
        width: 90,
        height: 90,
        borderRadius: borderRadius.md,
    },
    removeBtn: {
        position: 'absolute',
        top: 4,
        right: 4,
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: 'rgba(0,0,0,0.7)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    addBtn: {
        width: 90,
        height: 90,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderStyle: 'dashed',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
    },
    addText: {
        ...typography.caption,
    },
});
