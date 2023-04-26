import { Manager, styled } from '@twilio/flex-ui';
import { Box, Input } from '@twilio-paste/core';
import { SearchIcon } from '@twilio-paste/icons/esm/SearchIcon';

export interface SearchBoxProps {
  onInputChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export const LegacySearchIcon = () => {
  return (
    <div className="Twilio-Icon Twilio-Icon-Search  css-1j3rlv1">
      <svg>
        <path d="M15.742 14.153l3.091 3.091a.417.417 0 11-.589.59l-3.091-3.092a5.833 5.833 0 11.59-.59zm-4.409 1.18a5 5 0 100-10 5 5 0 000 10z"></path>
      </svg>
    </div>
  );
};

export const SearchInput = ({ onInputChange }: SearchBoxProps) => {
  const { WorkerDirectorySearchPlaceholder } = Manager.getInstance().strings;

  return (
    <Input
      element="TRANSFER_DIR_COMMON_SEARCH_BOX"
      insertBefore={false ? <SearchIcon decorative={false} title="Search Queue Names" /> : <LegacySearchIcon />}
      type="text"
      key="custom-directory-input-field"
      onChange={onInputChange}
      placeholder={WorkerDirectorySearchPlaceholder}
    />
  );
};

export const SearchBox = ({ onInputChange }: SearchBoxProps) => {
  return (
    <Box paddingLeft="space50" paddingRight="space50" paddingTop="space60" paddingBottom="space50">
      <SearchInput onInputChange={onInputChange} />
    </Box>
  );
};

export const ButtonContainer = styled('div')`
  display: none;
`;
