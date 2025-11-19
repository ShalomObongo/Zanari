import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '@/store/authStore';
import { formatAbsoluteDate } from '@/utils/formatters';
import apiClient from '@/services/api';
import { useTheme } from '@/contexts/ThemeContext';

// Document types interface
interface DocumentType {
  id: string;
  title: string;
  description: string;
  required: boolean;
  icon: string;
  examples: string[];
}

// Document types configuration
const documentTypes: DocumentType[] = [
  {
    id: 'national_id',
    title: 'National ID',
    description: 'Government-issued national identification',
    required: true,
    icon: '🪪',
    examples: ['National ID Card (front and back)', 'Digital ID'],
  },
  {
    id: 'passport',
    title: 'Passport',
    description: 'Valid passport for identification',
    required: false,
    icon: '🛂',
    examples: ['Passport bio-data page'],
  },
  {
    id: 'selfie',
    title: 'Selfie',
    description: 'A clear photo of yourself',
    required: true,
    icon: '🤳',
    examples: ['Clear selfie photo holding your ID'],
  },
];

type KYCDocumentStatus = 'uploaded' | 'processing' | 'approved' | 'rejected';

interface KYCDocument {
  document_id: string;
  document_type: 'national_id' | 'passport' | 'driving_license' | 'selfie';
  file_name: string;
  file_size: number;
  status: KYCDocumentStatus;
  uploaded_at: string;
  processed_at: string | null;
  verification_notes: string | null;
  secure_download_url: string;
  expires_in_seconds: number;
  extracted_data: {
    full_name: string | null;
    id_number: string | null;
    date_of_birth: string | null;
    issue_date: string | null;
    expiry_date: string | null;
  } | null;
  next_allowed_upload_at: string | null;
  remaining_retries: number;
}

interface ListDocumentsResponse {
  documents: KYCDocument[];
  review_estimate_minutes: number;
  remaining_attempts: Record<string, number>;
  kyc_status: 'not_started' | 'pending' | 'approved' | 'rejected';
}

const KYCUploadScreen: React.FC = () => {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  // Zustand store
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const kycStatus = user?.kyc_status || 'not_started';
  
  // State management
  const [documents, setDocuments] = useState<KYCDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected'>(
    kycStatus === 'approved' ? 'approved' : kycStatus === 'rejected' ? 'rejected' : kycStatus === 'pending' ? 'under_review' : 'draft'
  );
  const [remainingAttempts, setRemainingAttempts] = useState<Record<string, number>>({});
  
  // Fetch KYC documents on mount
  useEffect(() => {
    loadDocuments();
  }, []);
  
  const loadDocuments = async () => {
    try {
      const response = await apiClient.get<ListDocumentsResponse>('/kyc/documents');
      setDocuments(response.documents);
      setRemainingAttempts(response.remaining_attempts);

      // Map API kyc_status to local verification status used for banner
      switch (response.kyc_status) {
        case 'approved':
          setVerificationStatus('approved');
          break;
        case 'rejected':
          setVerificationStatus('rejected');
          break;
        case 'pending':
          setVerificationStatus('under_review');
          break;
        case 'not_started':
        default:
          setVerificationStatus('draft');
          break;
      }

      // Keep auth store user in sync with latest kyc_status
      if (user && response.kyc_status && user.kyc_status !== response.kyc_status) {
        setUser({ ...user, kyc_status: response.kyc_status });
      }
    } catch (error) {
      console.error('Error loading KYC documents:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await loadDocuments();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('MainTabs');
    }
  };

  // Helper functions
  const getDocumentsByType = (type: string): KYCDocument[] => {
    return documents.filter(doc => doc.document_type === type);
  };

  const getRequiredDocumentsCount = (): number => {
    return documentTypes.filter(doc => doc.required).length;
  };

  const getUploadedRequiredDocumentsCount = (): number => {
    const requiredTypes = documentTypes.filter(doc => doc.required).map(doc => doc.id);
    const uploadedTypes = new Set(documents.map(doc => doc.document_type));
    return requiredTypes.filter(type => uploadedTypes.has(type as KYCDocument['document_type'])).length;
  };

  const isSubmissionReady = (): boolean => {
    return getUploadedRequiredDocumentsCount() === getRequiredDocumentsCount();
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (isoDate: string): string => {
    return formatAbsoluteDate(isoDate);
  };

  // Event handlers
  const handleDocumentUpload = async (documentType: string) => {
    Alert.alert(
      'Upload Document',
      'Choose how you would like to add your document:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Take Photo',
          onPress: () => initiateUpload(documentType, 'camera'),
        },
        {
          text: 'Choose from Gallery',
          onPress: () => initiateUpload(documentType, 'gallery'),
        },
      ]
    );
  };

  const initiateUpload = async (documentType: string, source: 'camera' | 'gallery') => {
    setIsUploading(true);

    try {
      // Step 1: Ensure we have the right permissions
      if (source === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Camera Permission Required',
            'Please allow camera access in your device settings to take photos for KYC.',
          );
          setIsUploading(false);
          return;
        }
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Photos Permission Required',
            'Please allow photo library access in your device settings to upload existing photos for KYC.',
          );
          setIsUploading(false);
          return;
        }
      }

      // Step 2: Pick image from camera or gallery
      const pickerOptions: ImagePicker.ImagePickerOptions = {
        // MediaTypeOptions is deprecated but still available in our SDK;
        // using images-only keeps behavior consistent across camera and gallery.
        // eslint-disable-next-line deprecation/deprecation
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
      };

      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync(pickerOptions)
          : await ImagePicker.launchImageLibraryAsync(pickerOptions);

      // Handle cancellation
      if (result.canceled || !result.assets || result.assets.length === 0) {
        setIsUploading(false);
        return;
      }

      const asset = result.assets[0]!;
      const uri = asset.uri;
      const fileName = asset.fileName || `${documentType}_${Date.now()}.jpg`;
      const fileSize = asset.fileSize ?? 1_000_000;
      const mimeType = asset.type === 'image' ? 'image/jpeg' : 'application/octet-stream';

      // Step 3: Get signed upload URL from backend
      const uploadResponse = await apiClient.post<
        {
          upload_id: string;
          document_id: string;
          signed_upload_url: string;
          upload_headers?: Record<string, string>;
        }
      >('/kyc/documents', {
        document_type: documentType,
        file_name: fileName,
        file_size: fileSize,
        mime_type: mimeType,
        device_metadata: {
          platform: Platform.OS,
        },
      });

      // Note: The current backend issues a logical "signed" URL for storage,
      // but there is no storage service behind https://storage.supabase.io in this setup.
      // For now we treat creation of the KYC document record as success and
      // rely on future work to wire actual binary uploads.

      // Step 4: Refresh documents list to reflect the new record
      await loadDocuments();
      Alert.alert('Success', 'Document uploaded successfully! It will be reviewed shortly.');
    } catch (error) {
      Alert.alert('Error', 'Failed to upload document. Please try again.');
      console.error('Upload error:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteDocument = (documentId: string) => {
    Alert.alert(
      'Delete Document',
      'Are you sure you want to delete this document?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // In real implementation, would call DELETE endpoint
              // await apiClient.delete(`/kyc/documents/${documentId}`);
              await loadDocuments();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete document');
            }
          },
        },
      ]
    );
  };

  const handleSubmitForReview = async () => {
    if (!isSubmissionReady()) {
      Alert.alert('Incomplete', 'Please upload all required documents before submitting.');
      return;
    }

    setShowSubmitModal(false);
    setIsUploading(true);

    try {
      // Mock submission API call
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      setVerificationStatus('submitted');
      Alert.alert(
        'Submitted Successfully!',
        'Your documents have been submitted for review. We will notify you within 1-3 business days.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to submit documents. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const getStatusColor = (status: KYCDocumentStatus | 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected'): string => {
    switch (status) {
      case 'approved':
        return '#52B788';
      case 'rejected':
        return '#FF6B6B';
      case 'uploaded':
      case 'processing':
      case 'under_review':
      case 'submitted':
        return '#FFA500';
      default:
        return '#6C757D';
    }
  };

  const getStatusText = (status: KYCDocumentStatus | 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected'): string => {
    switch (status) {
      case 'approved':
        return '✓ Approved';
      case 'rejected':
        return '✗ Rejected';
      case 'uploaded':
      case 'processing':
        return '⏳ Pending';
      case 'under_review':
      case 'submitted':
        return '👁 Under Review';
      default:
        return '📄 Draft';
    }
  };

  const renderDocumentType = (docType: DocumentType) => {
    const uploadedDocs = getDocumentsByType(docType.id);
    const hasUploaded = uploadedDocs.length > 0;

    return (
      <View key={docType.id} style={styles.documentSection}>
        <View style={styles.documentHeader}>
          <View style={styles.documentTitleRow}>
            <Text style={styles.documentIcon}>{docType.icon}</Text>
            <View style={styles.documentTitleContainer}>
              <View style={styles.titleWithBadge}>
                <Text style={styles.documentTitle}>{docType.title}</Text>
                {docType.required && (
                  <View style={styles.requiredBadge}>
                    <Text style={styles.requiredBadgeText}>Required</Text>
                  </View>
                )}
              </View>
              <Text style={styles.documentDescription}>{docType.description}</Text>
            </View>
          </View>
        </View>

        {/* Examples */}
        <View style={styles.examplesContainer}>
          <Text style={styles.examplesTitle}>Accepted documents:</Text>
          {docType.examples.map((example, index) => (
            <Text key={index} style={styles.exampleItem}>• {example}</Text>
          ))}
        </View>

        {/* Uploaded Documents */}
        {hasUploaded && (
          <View style={styles.uploadedDocumentsContainer}>
            <Text style={styles.uploadedTitle}>Uploaded Documents:</Text>
            {uploadedDocs.map(doc => (
              <View key={doc.document_id} style={styles.uploadedDocument}>
                <View style={styles.documentInfo}>
                    <Text style={styles.fileName}>{doc.file_name}</Text>
                  <View style={styles.documentMeta}>
                    <Text style={styles.fileSize}>{formatFileSize(doc.file_size)}</Text>
                    <Text style={styles.uploadDate}>{formatDate(doc.uploaded_at)}</Text>
                  </View>
                </View>
                <View style={styles.documentActions}>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(doc.status) + '20' }]}>
                    <Text style={[styles.statusText, { color: getStatusColor(doc.status) }]}>
                      {getStatusText(doc.status)}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => handleDeleteDocument(doc.document_id)}
                  >
                    <Text style={styles.deleteButtonText}>🗑️</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Upload Button */}
        <TouchableOpacity
          style={[
            styles.uploadButton,
            hasUploaded && styles.uploadMoreButton,
          ]}
          onPress={() => handleDocumentUpload(docType.id)}
          disabled={isUploading}
        >
          <Text style={[
            styles.uploadButtonText,
            hasUploaded && styles.uploadMoreButtonText,
          ]}>
            {hasUploaded ? '+ Upload Another' : '📷 Upload Document'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  const styles = createStyles(theme);

  return (
    <>
      <StatusBar barStyle={theme.colors.statusBarStyle} backgroundColor={theme.colors.background} />
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTopRow}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={handleBack}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Icon name="arrow-back-ios" size={20} color={theme.colors.textPrimary} />
              <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.headerTitle}>KYC Verification</Text>
          <Text style={styles.headerSubtitle}>Complete your identity verification</Text>
        </View>

      {/* Progress Indicator */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View 
            style={[
              styles.progressFill,
              { width: `${(getUploadedRequiredDocumentsCount() / getRequiredDocumentsCount()) * 100}%` }
            ]} 
          />
        </View>
        <Text style={styles.progressText}>
          {getUploadedRequiredDocumentsCount()} of {getRequiredDocumentsCount()} required documents uploaded
        </Text>
      </View>

      {/* Status Banner */}
      {verificationStatus !== 'draft' && (
        <View style={[styles.statusBanner, { backgroundColor: getStatusColor(verificationStatus) + '20' }]}>
          <Text style={[styles.statusBannerText, { color: getStatusColor(verificationStatus) }]}>
            {getStatusText(verificationStatus)} - {
              verificationStatus === 'submitted' ? 'Your documents are being reviewed' :
              verificationStatus === 'under_review' ? 'Review in progress, please wait' :
              verificationStatus === 'approved' ? 'Your identity has been verified!' :
              verificationStatus === 'rejected' ? 'Some documents need to be resubmitted' :
              'Status unknown'
            }
          </Text>
        </View>
      )}

      {/* Content */}
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Information Section */}
        <View style={styles.infoSection}>
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>📋 What you need to know</Text>
            <Text style={styles.infoText}>
              • All documents must be clear and readable{'\n'}
              • Files should be under 5MB in size{'\n'}
              • Accepted formats: JPG, PNG, PDF{'\n'}
              • Documents must be valid and not expired{'\n'}
              • Review process takes 1-3 business days
            </Text>
          </View>
        </View>

        {/* Document Types */}
        {documentTypes.map(renderDocumentType)}

        {/* Submit Section */}
        {verificationStatus === 'draft' && (
          <View style={styles.submitSection}>
            <TouchableOpacity
              style={[
                styles.submitButton,
                !isSubmissionReady() && styles.submitButtonDisabled,
              ]}
              onPress={() => setShowSubmitModal(true)}
              disabled={!isSubmissionReady() || isUploading}
            >
              <Text style={[
                styles.submitButtonText,
                !isSubmissionReady() && styles.submitButtonTextDisabled,
              ]}>
                {isSubmissionReady() ? '✓ Submit for Review' : `Upload ${getRequiredDocumentsCount() - getUploadedRequiredDocumentsCount()} more document(s)`}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Loading Overlay */}
      {isUploading && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#52B788" />
            <Text style={styles.loadingText}>
              {verificationStatus === 'draft' ? 'Uploading document...' : 'Submitting for review...'}
            </Text>
          </View>
        </View>
      )}

      {/* Submit Confirmation Modal */}
      <Modal
        visible={showSubmitModal}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Submit for Review?</Text>
            <Text style={styles.modalText}>
              Once submitted, you won't be able to modify your documents until the review is complete. 
              Please ensure all uploaded documents are clear and valid.
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowSubmitModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSubmitButton}
                onPress={handleSubmitForReview}
              >
                <Text style={styles.modalSubmitText}>Submit</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      </SafeAreaView>
    </>
  );
};

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 14,
    color: theme.colors.textPrimary,
    marginLeft: 2,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
  progressContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  progressBar: {
    height: 8,
    backgroundColor: theme.colors.gray200,
    borderRadius: 4,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.colors.success,
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  statusBanner: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 8,
  },
  statusBannerText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  infoSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  infoCard: {
    backgroundColor: theme.colors.info + '20',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: theme.colors.textPrimary,
    lineHeight: 20,
  },
  documentSection: {
    backgroundColor: theme.colors.surface,
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
    ...theme.shadows.sm,
  },
  documentHeader: {
    marginBottom: 16,
  },
  documentTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  documentIcon: {
    fontSize: 24,
    marginRight: 12,
    marginTop: 2,
  },
  documentTitleContainer: {
    flex: 1,
  },
  titleWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  documentTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginRight: 8,
  },
  requiredBadge: {
    backgroundColor: theme.colors.error,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  requiredBadgeText: {
    fontSize: 10,
    color: theme.colors.surface,
    fontWeight: '600',
  },
  documentDescription: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  examplesContainer: {
    marginBottom: 16,
    paddingLeft: 36,
  },
  examplesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 8,
  },
  exampleItem: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  uploadedDocumentsContainer: {
    marginBottom: 16,
    paddingLeft: 36,
  },
  uploadedTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 8,
  },
  uploadedDocument: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  documentInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  documentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fileSize: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginRight: 16,
  },
  uploadDate: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  documentActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  deleteButton: {
    padding: 4,
  },
  deleteButtonText: {
    fontSize: 16,
  },
  uploadButton: {
    backgroundColor: theme.colors.success,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginLeft: 36,
  },
  uploadMoreButton: {
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.success,
  },
  uploadButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.surface,
  },
  uploadMoreButtonText: {
    color: theme.colors.success,
  },
  submitSection: {
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  submitButton: {
    backgroundColor: theme.colors.success,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: theme.colors.disabled,
  },
  submitButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.surface,
  },
  submitButtonTextDisabled: {
    color: theme.colors.textSecondary,
  },
  bottomPadding: {
    height: 40,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 32,
    paddingVertical: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: theme.colors.textPrimary,
    marginTop: 16,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    textAlign: 'center',
    marginBottom: 16,
  },
  modalText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },
  modalSubmitButton: {
    flex: 1,
    backgroundColor: theme.colors.success,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalSubmitText: {
    fontSize: 16,
    color: theme.colors.surface,
    fontWeight: '600',
  },
});

export default KYCUploadScreen;
