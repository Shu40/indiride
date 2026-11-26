import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GUJARAT_INSTITUTIONS_LIST, GujaratInstitution } from '../../data/gujaratInstitutions';
import { api } from '../../services/api';

interface InstitutionMultiSelectModalProps {
  visible: boolean;
  onClose: () => void;
  selectedInstitutions: string; // Comma separated string e.g. "Parul University, MSU"
  onConfirm: (selectedInstitutionsString: string) => void;
  title?: string;
  subtitle?: string;
}

export const InstitutionMultiSelectModal: React.FC<InstitutionMultiSelectModalProps> = ({
  visible,
  onClose,
  selectedInstitutions,
  onConfirm,
  title = 'Gujarat Universities, Colleges & Schools',
  subtitle = 'Select all institutions you want to serve as a driver partner',
}) => {
  // Local selection state
  const [selectedList, setSelectedList] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeCategory, setActiveCategory] = useState<'ALL' | 'University' | 'College' | 'School'>('ALL');
  const [allInstitutions, setAllInstitutions] = useState<GujaratInstitution[]>(GUJARAT_INSTITUTIONS_LIST);
  const [loadingBackend, setLoadingBackend] = useState<boolean>(false);

  // "Other" institution form state
  const [showOtherForm, setShowOtherForm] = useState<boolean>(false);
  const [otherName, setOtherName] = useState<string>('');
  const [otherCity, setOtherCity] = useState<string>('');
  const [otherCategory, setOtherCategory] = useState<'University' | 'College' | 'School'>('College');
  const [savingOther, setSavingOther] = useState<boolean>(false);
  const [otherSuccessMsg, setOtherSuccessMsg] = useState<string>('');

  // Sync initial selection when modal opens
  useEffect(() => {
    if (visible) {
      const parsed = (selectedInstitutions || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      setSelectedList(parsed);
      setSearchQuery('');
      setShowOtherForm(false);
      setOtherSuccessMsg('');

      // Fetch latest list from backend DB to merge any custom added universities
      fetchBackendInstitutions();
    }
  }, [visible, selectedInstitutions]);

  const fetchBackendInstitutions = async () => {
    try {
      setLoadingBackend(true);
      const res = await api.campusRides.getUniversities({ state: 'Gujarat' });
      if (Array.isArray(res) && res.length > 0) {
        setAllInstitutions((prev) => {
          const map = new Map<string, GujaratInstitution>();
          // Add default seed list
          prev.forEach((item) => map.set(item.name.toLowerCase().trim(), item));
          // Add DB institutions
          res.forEach((uni) => {
            const key = uni.name.toLowerCase().trim();
            if (!map.has(key)) {
              let cat: 'University' | 'College' | 'School' = 'University';
              const low = key;
              if (low.includes('school') || low.includes('vidyalaya') || low.includes('academy')) {
                cat = 'School';
              } else if (low.includes('college') || low.includes('institute') || low.includes('campus')) {
                cat = 'College';
              }
              map.set(key, {
                id: uni.id,
                name: uni.name,
                shortName: uni.short_name,
                city: uni.city || 'Gujarat',
                category: cat,
              });
            }
          });
          return Array.from(map.values());
        });
      }
    } catch (e) {
      // Keep static list if backend query fails or is offline
    } finally {
      setLoadingBackend(false);
    }
  };

  // Toggle selection
  const toggleSelection = (name: string) => {
    const clean = name.trim();
    if (!clean) return;
    const lower = clean.toLowerCase();
    const exists = selectedList.some((s) => s.toLowerCase() === lower);

    if (exists) {
      setSelectedList((prev) => prev.filter((s) => s.toLowerCase() !== lower));
    } else {
      setSelectedList((prev) => [...prev, clean]);
    }
  };

  const removeSelection = (name: string) => {
    const lower = name.toLowerCase().trim();
    setSelectedList((prev) => prev.filter((s) => s.toLowerCase().trim() !== lower));
  };

  const clearAll = () => {
    setSelectedList([]);
  };

  // Filtered institutions
  const filteredList = useMemo(() => {
    let list = allInstitutions;

    // Filter by Category
    if (activeCategory !== 'ALL') {
      list = list.filter((i) => i.category === activeCategory);
    }

    // Filter by Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          (i.shortName && i.shortName.toLowerCase().includes(q)) ||
          i.city.toLowerCase().includes(q)
      );
    }

    return list;
  }, [allInstitutions, activeCategory, searchQuery]);

  // Handle saving new institution ("Other") to DB
  const handleSaveOtherInstitution = async () => {
    const trimmedName = otherName.trim();
    if (!trimmedName || trimmedName.length < 3) {
      Alert.alert('Required', 'Please enter a valid institution name (at least 3 characters).');
      return;
    }

    const city = otherCity.trim() || 'Gujarat';

    try {
      setSavingOther(true);
      setOtherSuccessMsg('');

      // Save to backend database
      const created = await api.campusRides.createUniversity({
        name: trimmedName,
        city: city,
        state: 'Gujarat',
      });

      const newItem: GujaratInstitution = {
        id: created.id || `custom_${Date.now()}`,
        name: created.name || trimmedName,
        city: created.city || city,
        category: otherCategory,
      };

      // Add to list and select it
      setAllInstitutions((prev) => [newItem, ...prev.filter((i) => i.name.toLowerCase() !== trimmedName.toLowerCase())]);
      setSelectedList((prev) => {
        if (!prev.some((p) => p.toLowerCase() === trimmedName.toLowerCase())) {
          return [...prev, newItem.name];
        }
        return prev;
      });

      setOtherSuccessMsg(`✅ "${trimmedName}" saved to database & selected!`);
      setOtherName('');
      setOtherCity('');
      setTimeout(() => {
        setShowOtherForm(false);
        setOtherSuccessMsg('');
      }, 1500);
    } catch (err: any) {
      // Fallback: local add even if offline
      const newItem: GujaratInstitution = {
        id: `custom_${Date.now()}`,
        name: trimmedName,
        city: city,
        category: otherCategory,
      };
      setAllInstitutions((prev) => [newItem, ...prev]);
      setSelectedList((prev) => [...prev, trimmedName]);
      setOtherSuccessMsg(`✅ "${trimmedName}" added & selected!`);
      setOtherName('');
      setOtherCity('');
      setTimeout(() => {
        setShowOtherForm(false);
        setOtherSuccessMsg('');
      }, 1500);
    } finally {
      setSavingOther(false);
    }
  };

  const handleConfirm = () => {
    onConfirm(selectedList.join(', '));
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={styles.headerBadge}>GUJARAT INSTITUTIONS</Text>
                {loadingBackend && <ActivityIndicator size="small" color="#16a34a" style={{ marginLeft: 8 }} />}
              </View>
              <Text style={styles.headerTitle}>{title}</Text>
              <Text style={styles.headerSubtitle}>{subtitle}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color="#64748b" />
            </TouchableOpacity>
          </View>

          {/* Selected Chips Strip */}
          {selectedList.length > 0 && (
            <View style={styles.selectedStrip}>
              <View style={styles.selectedStripHeader}>
                <Text style={styles.selectedStripTitle}>
                  Selected ({selectedList.length}):
                </Text>
                <TouchableOpacity onPress={clearAll}>
                  <Text style={styles.clearAllText}>Clear All</Text>
                </TouchableOpacity>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
                {selectedList.map((item, idx) => (
                  <View key={idx} style={styles.selectedChip}>
                    <Ionicons name="school" size={13} color="#15803d" style={{ marginRight: 4 }} />
                    <Text style={styles.selectedChipText} numberOfLines={1}>
                      {item}
                    </Text>
                    <TouchableOpacity onPress={() => removeSelection(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="close-circle" size={16} color="#15803d" style={{ marginLeft: 4 }} />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Search Box */}
          <View style={styles.searchBox}>
            <Ionicons name="search" size={18} color="#64748b" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search university, college, school, or city..."
              placeholderTextColor="#94a3b8"
              value={searchQuery}
              onChangeText={setSearchQuery}
              clearButtonMode="while-editing"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color="#94a3b8" />
              </TouchableOpacity>
            )}
          </View>

          {/* Category Tabs */}
          <View style={styles.categoryTabs}>
            {(
              [
                { id: 'ALL', label: 'All (सभी)', icon: 'grid-outline' },
                { id: 'University', label: 'Universities (यूनिवर्सिटी)', icon: 'business-outline' },
                { id: 'College', label: 'Colleges (कॉलेज)', icon: 'library-outline' },
                { id: 'School', label: 'Schools (स्कूल)', icon: 'school-outline' },
              ] as const
            ).map((tab) => (
              <TouchableOpacity
                key={tab.id}
                style={[styles.categoryTab, activeCategory === tab.id && styles.categoryTabActive]}
                onPress={() => setActiveCategory(tab.id)}
              >
                <Text style={[styles.categoryTabText, activeCategory === tab.id && styles.categoryTabTextActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* "Other" Option Toggle Button */}
          <View style={styles.otherOptionBar}>
            <TouchableOpacity
              style={[styles.otherToggleBtn, showOtherForm && styles.otherToggleBtnOpen]}
              onPress={() => setShowOtherForm(!showOtherForm)}
            >
              <Ionicons
                name={showOtherForm ? 'chevron-up-circle' : 'add-circle'}
                size={18}
                color={showOtherForm ? '#0f766e' : '#16a34a'}
                style={{ marginRight: 6 }}
              />
              <Text style={[styles.otherToggleBtnText, showOtherForm && { color: '#0f766e' }]}>
                {showOtherForm ? 'Close Other Institution Form' : '➕ Other: Add New University / College / School'}
              </Text>
            </TouchableOpacity>

            {/* Other Form Dropdown */}
            {showOtherForm && (
              <View style={styles.otherFormCard}>
                <Text style={styles.otherFormHeading}>
                  Can't find your institution? Add it to save in the database:
                </Text>

                <View style={styles.otherField}>
                  <Text style={styles.otherFieldLabel}>Institution Full Name *</Text>
                  <TextInput
                    style={styles.otherInput}
                    placeholder="e.g. Government Arts & Science College, Gandhinagar"
                    placeholderTextColor="#94a3b8"
                    value={otherName}
                    onChangeText={setOtherName}
                  />
                </View>

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={[styles.otherField, { flex: 1 }]}>
                    <Text style={styles.otherFieldLabel}>City / Location *</Text>
                    <TextInput
                      style={styles.otherInput}
                      placeholder="e.g. Vadodara, Ahmedabad, Surat"
                      placeholderTextColor="#94a3b8"
                      value={otherCity}
                      onChangeText={setOtherCity}
                    />
                  </View>

                  <View style={[styles.otherField, { flex: 1 }]}>
                    <Text style={styles.otherFieldLabel}>Type</Text>
                    <View style={styles.typeSelector}>
                      {(['University', 'College', 'School'] as const).map((t) => (
                        <TouchableOpacity
                          key={t}
                          style={[styles.typePill, otherCategory === t && styles.typePillActive]}
                          onPress={() => setOtherCategory(t)}
                        >
                          <Text style={[styles.typePillText, otherCategory === t && styles.typePillTextActive]}>
                            {t}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </View>

                {otherSuccessMsg ? (
                  <Text style={styles.otherSuccessText}>{otherSuccessMsg}</Text>
                ) : null}

                <TouchableOpacity
                  style={[styles.saveOtherBtn, savingOther && { opacity: 0.7 }]}
                  onPress={handleSaveOtherInstitution}
                  disabled={savingOther}
                >
                  {savingOther ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <>
                      <Ionicons name="cloud-upload" size={16} color="#ffffff" style={{ marginRight: 6 }} />
                      <Text style={styles.saveOtherBtnText}>Save to Database & Select</Text>
                    </>
                  )}
                </TouchableOpacity>
                <Text style={styles.otherHint}>
                  💡 This new institution will be stored in IndiRide's database and will be available for all future drivers and students!
                </Text>
              </View>
            )}
          </View>

          {/* Results List */}
          <ScrollView style={styles.listContainer} keyboardShouldPersistTaps="handled">
            <Text style={styles.resultsCount}>
              Showing {filteredList.length} institutions across Gujarat
            </Text>

            {filteredList.map((inst) => {
              const isSelected = selectedList.some((s) => s.toLowerCase() === inst.name.toLowerCase());
              return (
                <TouchableOpacity
                  key={inst.id}
                  style={[styles.instRow, isSelected && styles.instRowSelected]}
                  onPress={() => toggleSelection(inst.name)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
                    {isSelected && <Ionicons name="checkmark" size={14} color="#ffffff" />}
                  </View>

                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                      <Text style={[styles.instName, isSelected && styles.instNameSelected]}>
                        {inst.name}
                      </Text>
                      {inst.shortName && (
                        <View style={styles.shortNameBadge}>
                          <Text style={styles.shortNameText}>{inst.shortName}</Text>
                        </View>
                      )}
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
                      <Ionicons name="location-outline" size={12} color="#64748b" style={{ marginRight: 3 }} />
                      <Text style={styles.instCity}>{inst.city}</Text>
                      <Text style={styles.dotSeparator}>•</Text>
                      <Text style={styles.instCategory}>{inst.category}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}

            {filteredList.length === 0 && (
              <View style={styles.emptyState}>
                <Ionicons name="search-outline" size={36} color="#94a3b8" />
                <Text style={styles.emptyStateTitle}>No institution found</Text>
                <Text style={styles.emptyStateSubtitle}>
                  Try a different search term or click "➕ Other" above to add and save it!
                </Text>
              </View>
            )}
            <View style={{ height: 20 }} />
          </ScrollView>

          {/* Footer Actions */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm}>
              <Ionicons name="checkmark-done" size={18} color="#ffffff" style={{ marginRight: 6 }} />
              <Text style={styles.confirmBtnText}>
                Confirm Selection ({selectedList.length})
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 620,
    maxHeight: '92%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  headerBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: '#16a34a',
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    letterSpacing: 0.5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 4,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  selectedStrip: {
    backgroundColor: '#f0fdf4',
    borderBottomWidth: 1,
    borderBottomColor: '#bbf7d0',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  selectedStripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  selectedStripTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#15803d',
  },
  clearAllText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#b91c1c',
  },
  chipsScroll: {
    flexDirection: 'row',
  },
  selectedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dcfce7',
    borderWidth: 1,
    borderColor: '#86efac',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginRight: 6,
    maxWidth: 220,
  },
  selectedChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#166534',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 14,
    marginTop: 10,
    marginBottom: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0f172a',
  },
  categoryTabs: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    marginBottom: 8,
    gap: 6,
  },
  categoryTab: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  categoryTabActive: {
    backgroundColor: '#16a34a',
    borderColor: '#15803d',
  },
  categoryTabText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  categoryTabTextActive: {
    color: '#ffffff',
  },
  otherOptionBar: {
    marginHorizontal: 14,
    marginBottom: 8,
  },
  otherToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#86efac',
    borderStyle: 'dashed',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  otherToggleBtnOpen: {
    backgroundColor: '#f0fdfa',
    borderColor: '#5eead4',
  },
  otherToggleBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#15803d',
  },
  otherFormCard: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    padding: 12,
    marginTop: 6,
  },
  otherFormHeading: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
  },
  otherField: {
    marginBottom: 8,
  },
  otherFieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 4,
  },
  otherInput: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
    color: '#0f172a',
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 4,
  },
  typePill: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
  },
  typePillActive: {
    backgroundColor: '#0f766e',
    borderColor: '#0f766e',
  },
  typePillText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#475569',
  },
  typePillTextActive: {
    color: '#ffffff',
  },
  otherSuccessText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#16a34a',
    marginBottom: 6,
  },
  saveOtherBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f766e',
    borderRadius: 8,
    paddingVertical: 9,
    marginTop: 4,
  },
  saveOtherBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  otherHint: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 6,
    fontStyle: 'italic',
  },
  listContainer: {
    flex: 1,
    paddingHorizontal: 14,
  },
  resultsCount: {
    fontSize: 11,
    color: '#94a3b8',
    marginBottom: 6,
  },
  instRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    marginBottom: 6,
  },
  instRowSelected: {
    backgroundColor: '#f0fdf4',
    borderColor: '#86efac',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  checkboxActive: {
    backgroundColor: '#16a34a',
    borderColor: '#16a34a',
  },
  instName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1e293b',
  },
  instNameSelected: {
    color: '#14532d',
    fontWeight: '700',
  },
  shortNameBadge: {
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  shortNameText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  instCity: {
    fontSize: 11,
    color: '#64748b',
  },
  dotSeparator: {
    marginHorizontal: 5,
    fontSize: 11,
    color: '#cbd5e1',
  },
  instCategory: {
    fontSize: 11,
    color: '#16a34a',
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
  },
  emptyStateTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
    marginTop: 8,
  },
  emptyStateSubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 300,
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    backgroundColor: '#ffffff',
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  confirmBtn: {
    flex: 2,
    flexDirection: 'row',
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: '#16a34a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
});
