// Port of TestForScene15.cs (TestForScene15) from AltTester-Unity-SDK-Closed-Source sdk-package/Assets/Examples/Test/Editor/Driver
import { describe, expect, it } from 'vitest';
import { AltKeyCode, By } from '../../../src/binding';
import { sleep } from './setup';
import { useTestBase } from './testBase';

// View A
const BtnPlusPath = '//New Panel Settings//btn-plus';
const LabelAPath = '//New Panel Settings//counter-label';
const BtnMinusPath = '//New Panel Settings//btn-minus';
const ToggleThemePath = '//New Panel Settings//toggle-theme';
const TextFieldNamePath = '//New Panel Settings//textfield-name';

// View B
const SliderLabelPath = '//New Panel Settings//slider-label';
const MainSliderPath = '//New Panel Settings//main-slider';
const ScrollViewPath = '//New Panel Settings//scroll-view';

// View C
const BtnLongPressPath = '//New Panel Settings//btn-longpress';
const DragAreaPath = '//New Panel Settings//drag-area';
const DraggableItemPath = '//New Panel Settings//draggable-item';

// Tab bar
const TabAPath = '//New Panel Settings//tab-A';
const TabBPath = '//New Panel Settings//tab-B';
const TabCPath = '//New Panel Settings//tab-C';

describe('TestForScene15', () => {
  // The C# SetUp override only calls base.SetUp().
  const getDriver = useTestBase('Scene 15 UIToolkit');

  const waitForPath = (path: string, timeout?: number) => getDriver().waitForObject(By.PATH, path, By.NAME, '', timeout);

  // ── View A ──────────────────────────────────────────────────────────────

  it('Test_CounterIncrement', async () => {
    const BtnPlus = await waitForPath(BtnPlusPath, 5);
    await BtnPlus.click();
    const counterLabel = await waitForPath(LabelAPath);
    expect(await counterLabel.getText()).toBe('1');
    await BtnPlus.click();
    expect(await counterLabel.getText()).toBe('2');
  });

  it('Test_CounterDecrement', async () => {
    const btnMinus = await waitForPath(BtnMinusPath, 5);
    await btnMinus.click();
    const counterLabel = await waitForPath(LabelAPath, 5);
    expect(await counterLabel.getText()).toBe('-1');
  });

  it('Test_CounterIncrement_And_Decrement', async () => {
    const btnPlus = await waitForPath(BtnPlusPath, 5);
    const btnMinus = await waitForPath(BtnMinusPath, 5);
    const counterLabel = await waitForPath(LabelAPath, 5);
    await btnPlus.click();
    await btnPlus.click();
    expect(await counterLabel.getText()).toBe('2');
    await btnMinus.click();
    expect(await counterLabel.getText()).toBe('1');
  });

  it('Test_Counter_Initial_Value', async () => {
    const counterLabel = await waitForPath(LabelAPath, 5);
    expect(await counterLabel.getText()).toBe('0');
  });

  it('Test_Toggle_EnableLightTheme', async () => {
    const toggle = await waitForPath(ToggleThemePath, 5);
    expect(toggle).not.toBeNull();
    await toggle.click();
    const toggleAfterClick = await waitForPath(ToggleThemePath, 5);
    const valueAfterClick = await toggleAfterClick.getVisualElementProperty<boolean>('value');
    expect(valueAfterClick).toBe(true);
    await toggle.click();
    const toggleAfterSecondClick = await waitForPath(ToggleThemePath, 5);
    const valueAfterSecondClick = await toggleAfterSecondClick.getVisualElementProperty<boolean>('value');
    expect(valueAfterSecondClick).toBe(false);
  });

  it('Test_TextField_SetPlayerName', async () => {
    const textField = await waitForPath(TextFieldNamePath, 5);
    expect(textField).not.toBeNull();
    await textField.setText('AltTester');
    const updatedField = await waitForPath(TextFieldNamePath, 5);
    expect(await updatedField.getText()).toBe('AltTester');
  });

  it('Test_TextField_ClearAndRetype', async () => {
    const textField = await waitForPath(TextFieldNamePath, 5);
    await textField.setText('First');
    await textField.setText('Second');
    const updatedField = await waitForPath(TextFieldNamePath, 5);
    expect(await updatedField.getText()).toBe('Second');
  });

  it('Test_TabA_IsActiveByDefault', async () => {
    const tabA = await waitForPath(TabAPath, 5);
    expect(tabA).not.toBeNull();
    const viewA = await waitForPath('//New Panel Settings//viewA', 5);
    expect(viewA).not.toBeNull();
  });

  it('Test_TabNavigation_AllTabs_Exist', async () => {
    const tabA = await waitForPath(TabAPath, 5);
    const tabB = await waitForPath(TabBPath, 5);
    const tabC = await waitForPath(TabCPath, 5);
    expect(await tabA.getText()).toBe('View A');
    expect(await tabB.getText()).toBe('View B');
    expect(await tabC.getText()).toBe('View C');
  });

  it('Test_TabNavigation_To_ViewB_And_Swipe_Slider', async () => {
    const navB = await waitForPath(TabBPath, 5);
    await navB.tap();
    const sliderLabel = await waitForPath(SliderLabelPath, 5);
    expect(await sliderLabel.getText()).toBe('50');
    const slider = await waitForPath(MainSliderPath, 5);
    const sliderPos = slider.getScreenPosition();
    await getDriver().swipe(sliderPos, { x: sliderPos.x + 5000, y: sliderPos.y }, 0.5);
    expect(await sliderLabel.getText()).toBe('100');
  });

  it('Test_ViewB_Slider_InitialValue', async () => {
    const tabB = await waitForPath(TabBPath, 5);
    await tabB.tap();
    const sliderLabel = await waitForPath(SliderLabelPath, 5);
    expect(await sliderLabel.getText()).toBe('50');
  });

  it('Test_ViewB_Slider_SwipeToMin', async () => {
    const tabB = await waitForPath(TabBPath, 5);
    await tabB.tap();
    const slider = await waitForPath(MainSliderPath, 5);
    await getDriver().swipe(slider.getScreenPosition(), { x: 0, y: slider.getScreenPosition().y }, 0.5);
    const sliderLabel = await waitForPath(SliderLabelPath, 5);
    expect(await sliderLabel.getText()).toBe('0');
  });

  it('Test_ViewB_ScrollView_Exists', async () => {
    const tabB = await waitForPath(TabBPath, 5);
    await tabB.tap();
    const scrollView = await waitForPath(ScrollViewPath, 5);
    expect(scrollView).not.toBeNull();
  });

  it('Test_TabNavigation_To_ViewC', async () => {
    const tabC = await waitForPath(TabCPath, 5);
    await tabC.tap();
    const btnLongPress = await waitForPath(BtnLongPressPath, 5);
    expect(btnLongPress).not.toBeNull();
    expect(await btnLongPress.getText()).toBe('Hold Me (Long Press)');
  });

  // [Ignore("This test is currently flaky and needs investigation. It may be related to how the long press is being
  // simulated or how the UI updates after the long press.")]
  it.skip('Test_ViewC_LongPress_Button', async () => {
    const altDriver = getDriver();
    const tabC = await waitForPath(TabCPath, 5);
    await tabC.tap();
    const btnLongPress = await waitForPath(BtnLongPressPath, 5);
    await altDriver.moveMouse(btnLongPress.getScreenPosition());
    await altDriver.keyDown(AltKeyCode.Mouse0);
    await sleep(3); // Wait for any UI updates after long press
    const btnAfter = await waitForPath(BtnLongPressPath, 5);
    const text = await btnAfter.getText();
    await altDriver.keyUp(AltKeyCode.Mouse0);
    expect(
      text,
      "Button text should change to 'Success!' after long press. If it doesn't, the long press might not have been "
        + 'registered correctly.',
    ).toBe('Success!');
  });

  it('Test_ViewC_DragArea_Exists', async () => {
    const tabC = await waitForPath(TabCPath, 5);
    await tabC.tap();
    const dragArea = await waitForPath(DragAreaPath, 5);
    expect(dragArea).not.toBeNull();
  });

  it('Test_ViewC_DraggableItem_Exists', async () => {
    const tabC = await waitForPath(TabCPath, 5);
    await tabC.tap();
    const draggable = await waitForPath(DraggableItemPath, 5);
    expect(draggable).not.toBeNull();
  });

  it('Test_ViewC_Drag_DraggableItem', async () => {
    const tabC = await waitForPath(TabCPath, 5);
    await tabC.tap();
    const draggable = await waitForPath(DraggableItemPath, 5);
    const startPos = draggable.getScreenPosition();
    const endPos = { x: startPos.x + 100, y: startPos.y };
    await getDriver().swipe(startPos, endPos, 0.5);
    const draggableAfter = await waitForPath(DraggableItemPath, 5);
    expect(draggableAfter.getScreenPosition().x).not.toEqual(startPos.x);
  });
});
